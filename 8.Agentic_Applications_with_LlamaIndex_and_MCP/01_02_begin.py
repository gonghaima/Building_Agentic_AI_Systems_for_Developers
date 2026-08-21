import os
import asyncio
from typing import Optional
from llama_index.core.tools import FunctionTool
from llama_index.core.agent.workflow import FunctionAgent
from llama_index.llms.openai_like import OpenAILike
from llama_index.embeddings.ollama import OllamaEmbedding
from datasets import load_dataset
from llama_index.core import Document, VectorStoreIndex, Settings
from llama_index.core.memory import Memory
from llama_index.core.llms import ChatMessage

from dotenv import load_dotenv

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

# Use OpenRouter (OpenAI-compatible API) for the LLM so no large model sits
# in local RAM. OpenAILike (not OpenAI) is required because OpenRouter model
# names aren't in llama_index's hardcoded OpenAI model registry. OpenRouter
# doesn't serve embedding models, so embeddings stay on Ollama with the
# small all-minilm model (~45MB, not the memory hog).
Settings.llm = OpenAILike(
    model="openai/gpt-4o-mini",
    api_base="https://openrouter.ai/api/v1",
    api_key=OPENROUTER_API_KEY,
    context_window=128000,
    max_tokens=1024,
    is_chat_model=True,
    is_function_calling_model=True,
)
Settings.embed_model = OllamaEmbedding(model_name="all-minilm", base_url="http://localhost:11434")

def create_query_engine():
    ecommerce_dataset = load_dataset(
        "weaviate/agents", "query-agent-ecommerce", split="train", streaming=True
    )
    documents = [Document(text=row["properties"]["description"], 
                          metadata={"name": row["properties"]["name"], "price": row["properties"]["price"], "category": row["properties"]["category"]}) 
                          for row in ecommerce_dataset]
    index = VectorStoreIndex.from_documents(documents[:100])
    engine = index.as_query_engine(similarity_top_k=10)
    return engine

query_engine = create_query_engine()

def search_e_commerce_dataset(query: str) -> str:
    """Useful to search through clothing items and prices in an e-commerce dataset"""
    response = query_engine.query(query)
    return response.response


async def main():
    llm = OpenAILike(
        model="openai/gpt-4o-mini",
        api_base="https://openrouter.ai/api/v1",
        api_key=OPENROUTER_API_KEY,
        context_window=128000,
        max_tokens=1024,
        is_chat_model=True,
        is_function_calling_model=True,
    )
    agent_prompt = """
    You are a helpful assistant that can help answer simple user questions or
    search through clothing items and prices in an e-commerce dataset.
    """

    memory = Memory.from_defaults(token_limit=40000)

    agent = FunctionAgent(llm=llm,
                           tools=[search_e_commerce_dataset],
                           system_prompt=agent_prompt)

    while True:
        user_input = input("Enter your query: ")
        if user_input.lower() == "exit":
            break
        response = await agent.run(user_input, memory=memory)
        print(response)

        # FunctionAgent doesn't persist `memory` across separate `agent.run()`
        # calls (the workflow's context deep-copies it internally and drops
        # the copy afterward), so append both turns manually to keep history.
        await memory.aput(ChatMessage(role="user", content=user_input))
        await memory.aput(ChatMessage(role="assistant", content=str(response)))

if __name__ == "__main__":
    asyncio.run(main())
