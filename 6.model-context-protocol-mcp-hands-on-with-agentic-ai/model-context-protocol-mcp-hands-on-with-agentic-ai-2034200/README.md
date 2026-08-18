# Model Context Protocol (MCP): Hands-On with Agentic AI
This is the repository for the LinkedIn Learning course `Model Context Protocol (MCP): Hands-On with Agentic AI`. The full course is available from [LinkedIn Learning][lil-course-url].

![lil-thumbnail-url]

## Course Description

The Model Context Protocol (MCP) allows developers to add agent behavior to LLMs by providing a universal protocol providing context to language models so they can interface with data and applications in a consistent way. MCP servers expose resources (data), tools (actions), and prompts (instructions) for the LLM and the user to use in performing more complex operations. In this course you’ll explore how the MCP works in Claude Desktop to extend its functionality, and you’ll build your own MCP servers using Python and TypeScript to give LLMs new capabilities to do things on the computer, connect with external APIs, and perform advanced multi-step actions.

## Instructions
You can work with these files in GitHub Codespaces or in an editor on your computer.

To run the MCP servers in development mode using the MCP Inspector and test them in Claude Desktop and Cursor, you need to clone the repository to your computer.

## Contents
This repository contains folders with supporting files for the course. 

### Example MCP Servers
- [`mcp-server-examples/text-assist`](mcp-server-examples/text-assist): Python MCP server with tools to count characters and words in any given text
- [`mcp-server-examples/open-meteo-weather`](mcp-server-examples/open-meteo-weather): Python MCP server with tools to get current and forecasted weather from Open-Meteo
- [`mcp-server-examples/projectDocumenter`](mcp-server-examples/projectDocumenter): TypeScript MCP server with tools to summarize any project and generate comprehensive README.md documents
- [`mcp-server-examples/gh-models-comparison`](mcp-server-examples/gh-models-comparison): TypeScript MCP server with tools to list all available GitHub Models, compare models, and run completion comparisons between models

### Hands-on Practice
- [`gh-models-helper`](gh-models-helper): Starting point for "Building an advanced MCP server using TypeScript" 

### MCP Server Templates
- [`templates/mcp-server-python-template`](templates/mcp-server-python-template): README.md file with step-by-step instructions to set up a bare-bones MCP server using the [Python MCP SDK](https://github.com/modelcontextprotocol/python-sdk)
- [`templates/mcp-server-typescript-template`](templates/mcp-server-typescript-template): Scaffolding and instructions to set up a bare-bones MCP server using the [TypeScript MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk)


## Branches
This repository does not use branches.

## Installing
Each folder has a `README.md` file with installation instructions.

## Instructor

Morten Rand-Hendriksen

Principal Staff Instructor, Speaker, Web Designer, and Software Developer
         

Check out my other courses on [LinkedIn Learning](https://www.linkedin.com/learning/instructors/morten-rand-hendriksen?u=104).


[0]: # (Replace these placeholder URLs with actual course URLs)

[lil-course-url]: https://www.linkedin.com/learning/model-context-protocol-mcp-hands-on-with-agentic-ai-asi-text-models
[lil-thumbnail-url]: https://media.licdn.com/dms/image/v2/D4D0DAQEo2bybtTuBiQ/learning-public-crop_675_1200/B4DZW1p2_tG4Ac-/0/1742509404424?e=2147483647&v=beta&t=dltG64iWzxT4jhuX8znCpFVFa-4vJ0PlH6acDiPV93s

