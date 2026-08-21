from mcp import ClientSession, StdioServerParameters
from mcp.client.streamable_http import streamablehttp_client

from langchain_mcp_adapters.tools import load_mcp_tools
from langchain_mcp_adapters.prompts import load_mcp_prompt

from langgraph.prebuilt import create_react_agent
from langchain_openai import AzureChatOpenAI

import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

#-----------------------------------------------------------------------
# Setup the LLM for the HR Timeoff Agent
# This uses the Azure OpenAI service with a specific deployment
# Please replace the environment variables with your own values
#-----------------------------------------------------------------------


endpoint = os.getenv("ENDPOINT_URL")
deployment = os.getenv("DEPLOYMENT_NAME")
subscription_key = os.getenv("AZURE_OPENAI_API_KEY")
api_version=os.getenv("API_VERSION")

model=AzureChatOpenAI(
    azure_endpoint=endpoint,
    api_key=subscription_key,
    api_version=api_version,
    deployment_name=deployment,
)
#-----------------------------------------------------------------------
# Define the HR timeoff agent that will use the MCP server
# to manage timeoff requests.
#-----------------------------------------------------------------------
async def run_timeoff_agent(user: str, prompt: str,) -> str:

    # Make sure the right URL to the MCP Server is passed.
    # and MCP server is running and accessible
    mcp_server_url="http://localhost:8000/mcp"

    try:
        async with streamablehttp_client(mcp_server_url) as (read, write, _):
            async with ClientSession(read, write) as session:
                print("initializing session")
                await session.initialize()

                timeoff_tools = await load_mcp_tools(session)
                print("\nTools loaded :")
                for tool in timeoff_tools:
                    print("Tool : ", tool.name, " - ", tool.description)

                timeoff_prompt = await load_mcp_prompt(session,
                                    "get_llm_prompt",
                                    arguments={"user" : user, "prompt" : prompt})
                print("\nPrompt loaded :", timeoff_prompt)

                print("\nCreating agent instance")
                agent = create_react_agent(model, timeoff_tools)

                print("\nAnswering prompt : ", prompt)
                agent_response = await agent.ainvoke(
                    {"messages": timeoff_prompt})

                return agent_response["messages"][-1].content
    except Exception as e:
        print(f"Error: {e}")
        return "Error"

    

if __name__ == "__main__":
    #
    response = asyncio.run(
        run_timeoff_agent("Alice", 
                    "What is my time off balance?"))
    print("\nResponse: ", response)

    response = asyncio.run(
        run_timeoff_agent("Alice", 
                    "File a time off request for 5 days starting from 2025-05-05"))
    print("\nResponse: ", response)

    response = asyncio.run(
        run_timeoff_agent("Alice", 
                    "What is my time off balance now?"))
    print("\nResponse: ", response)