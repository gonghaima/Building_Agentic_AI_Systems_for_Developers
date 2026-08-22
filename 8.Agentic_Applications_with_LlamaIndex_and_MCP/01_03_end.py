import os, json
import asyncio
from pydantic import BaseModel
from workflows import Workflow, Context,step
from workflows.events import Event, StartEvent, StopEvent
from datasets import load_dataset
from llama_index.core import Document, VectorStoreIndex
from llama_index.embeddings.ollama import OllamaEmbedding
from llama_index.core import Settings
from llama_index.llms.openai_like import OpenAILike
from dotenv import load_dotenv
from llama_index.utils.workflow import (draw_all_possible_flows)

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

# Embeddings stay local on Ollama's small all-minilm model; the LLM goes
# through OpenRouter so no large model sits in local RAM.
Settings.embed_model = OllamaEmbedding(model_name="all-minilm", base_url="http://localhost:11434")
Settings.llm = OpenAILike(
    model="openai/gpt-4o-mini",
    api_base="https://openrouter.ai/api/v1",
    api_key=OPENROUTER_API_KEY,
    context_window=128000,
    max_tokens=1024,
    is_chat_model=True,
    is_function_calling_model=True,
)

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

class FirstWorkflow(Workflow):
    @step
    def start(self, ev: StartEvent) -> StopEvent:
        return StopEvent(f"Hello {ev.name}")

class EvaluateQuery(StartEvent):
    query: str

class ECommerceQuestion(Event):
    query: str

class OtherQuestion(Event):
    query: str

class EcommerceAgent(Workflow):
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.llm = OpenAILike(
            model="openai/gpt-4o-mini",
            api_base="https://openrouter.ai/api/v1",
            api_key=OPENROUTER_API_KEY,
            context_window=128000,
            max_tokens=1024,
            is_chat_model=True,
            is_function_calling_model=True,
        )

    @step
    def evaluate_query(self, ev: EvaluateQuery) -> ECommerceQuestion | OtherQuestion:
        response = self.llm.complete(
            f"""Given the query '{ev.query}', return the relevant category of the query. 
            If the query is about cloting items and proces, return 'ECommerce'. 
            If the query is about something else, return 'Other'."""
        )
        if response.text == "ECommerce":
            return ECommerceQuestion(query=ev.query)
        else:
            return OtherQuestion(query=ev.query)

    @step
    def answer_ecommerce_question(self, ev: ECommerceQuestion) -> StopEvent:
        response = query_engine.query(ev.query)
        return StopEvent(response.response)
    
    @step
    def answer_other_question(self, ev: OtherQuestion) -> StopEvent:
        response = self.llm.complete(
            f"""Inform the user that you are not able to answer that question: '{ev.query}' because you are an e-commerce agent
            for clothing items.
            Advise them on what you can help them with."""
        )
        return StopEvent(response.text)
    

async def main():
    agent = EcommerceAgent(verbose=True)
    # result = await agent.run(query="Where can I buy a macbook?")
    result = await agent.run(query="Do you have any linen shorts under $50?")
    draw_all_possible_flows(agent, filename="e_commerce_agent.html")

    print(result)

if __name__ == "__main__":
    asyncio.run(main())
