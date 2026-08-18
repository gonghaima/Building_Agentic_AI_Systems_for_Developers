import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Create an MCP server
const server = new McpServer({
  name: "ProjectDocumenter",
  version: "1.0.0"
});

// Tool to generate just project.md file
server.tool(
  "generate-project-md",
  "Create or update a project.md file that collects all relevant code for a project, respecting .gitignore",
  {
    projectPath: z.string().describe("Absolute path to the project directory")
  },
  async ({ projectPath }) => {
    try {
      // Validate project path
      try {
        const stats = await fs.stat(projectPath);
        if (!stats.isDirectory()) {
          return {
            content: [{ 
              type: "text", 
              text: `Error: The provided path is not a directory: ${projectPath}`
            }],
            isError: true
          };
        }
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `Error: Cannot access directory: ${projectPath}\n${error}`
          }],
          isError: true
        };
      }
      
      // Add project.md to .gitignore if it's not already there
      const gitignorePath = path.join(projectPath, '.gitignore');
      try {
        let gitignoreContent = '';
        try {
          gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');
        } catch (error) {
          // .gitignore doesn't exist yet, create it
          gitignoreContent = '';
        }

        if (!gitignoreContent.includes('project.md')) {
          const newEntry = gitignoreContent.endsWith('\n') ? 'project.md\n' : '\nproject.md\n';
          await fs.writeFile(gitignorePath, gitignoreContent + newEntry);
        }
      } catch (error) {
        console.error('Error updating .gitignore:', error);
      }
      
      // Create project.md file with all code files
      const projectMdPath = path.join(projectPath, 'project.md');
      const { ignoredPaths } = await getGitIgnoredPaths(projectPath);
      // Add project.md to ignored paths to prevent it from being included in the scan
      ignoredPaths.add(projectMdPath);
      const codeFiles = await collectCodeFiles({ dirPath: projectPath, ignoredPaths });
      
      // Check if we found any code files
      if (codeFiles.length === 0) {
        return {
          content: [{ 
              type: "text", 
              text: `No code files found in ${projectPath}. Please check the path and try again.`
          }],
          isError: true
        };
      }
      
      // Create project.md with all code files
      const projectMdContent = await generateProjectMd({ projectPath, codeFiles });
      await fs.writeFile(projectMdPath, projectMdContent);
      
      return {
        content: [{ 
            type: "text", 
            text: `Successfully created/updated project.md at ${projectMdPath} with ${codeFiles.length} files.`
        }]
      };
    } catch (error) {
      return {
        content: [{ 
            type: "text", 
            text: `Error generating project.md: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
);

// Tool to document a project by generating project.md and README.md
server.tool(
  "document-project",
  "Document a project by generating project.md and a comprehensive README.md",
  {
    projectPath: z.string().describe("Absolute path to the project directory"),
    updateExisting: z.boolean().optional().default(true).describe("Whether to update existing README.md if present")
  },
  async ({ projectPath, updateExisting }) => {
    try {
      // Step 1: Generate project.md first
      // Instead of calling an external function that returns a result object,
      // we'll perform the logic directly here
      
      // Validate project path
      try {
        const stats = await fs.stat(projectPath);
        if (!stats.isDirectory()) {
          return {
            content: [{ 
              type: "text", 
              text: `Error: The provided path is not a directory: ${projectPath}`
            }],
            isError: true
          };
        }
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `Error: Cannot access directory: ${projectPath}\n${error}`
          }],
          isError: true
        };
      }
      
      // Add project.md to .gitignore if it's not already there
      const gitignorePath = path.join(projectPath, '.gitignore');
      try {
        let gitignoreContent = '';
        try {
          gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');
        } catch (error) {
          // .gitignore doesn't exist yet
          gitignoreContent = '';
        }

        if (!gitignoreContent.includes('project.md')) {
          const newEntry = gitignoreContent.endsWith('\n') ? 'project.md\n' : '\nproject.md\n';
          await fs.writeFile(gitignorePath, gitignoreContent + newEntry);
        }
      } catch (error) {
        console.error('Error updating .gitignore:', error);
      }
      
      // Create project.md file with all code files
      const projectMdPath = path.join(projectPath, 'project.md');
      const { ignoredPaths } = await getGitIgnoredPaths(projectPath);
      // Add project.md to ignored paths to prevent it from being included in the scan
      ignoredPaths.add(projectMdPath);
      const codeFiles = await collectCodeFiles({ dirPath: projectPath, ignoredPaths });
      
      // Check if we found any code files
      if (codeFiles.length === 0) {
        return {
          content: [{ 
            type: "text", 
            text: `No code files found in ${projectPath}. Please check the path and try again.`
          }],
          isError: true
        };
      }
      
      // Create project.md with all code files
      const projectMdContent = await generateProjectMd({ projectPath, codeFiles });
      await fs.writeFile(projectMdPath, projectMdContent);
      
      // Step 2: Check for existing README.md
      const readmePath = path.join(projectPath, 'README.md');
      let existingReadme = null;
      try {
        existingReadme = await fs.readFile(readmePath, 'utf-8');
        if (!updateExisting) {
          return {
            content: [{ 
              type: "text", 
              text: `README.md already exists at ${readmePath} and updateExisting is set to false.`
            }]
          };
        }
      } catch (error) {
        // README doesn't exist, which is fine - we'll create a new one
      }
      
      // Generate a placeholder README.md if it doesn't exist
      if (!existingReadme) {
        await fs.writeFile(
          readmePath, 
          "# Project Documentation\n\n*This README will be updated with comprehensive documentation based on the project.md file.*"
        );
      }
      
      return {
        content: [{ 
          type: "text", 
          text: `Project documentation preparation complete:
1. Created/updated project.md at ${projectMdPath}
2. ${existingReadme ? "Existing README.md is ready for updating" : "Created placeholder README.md"} at ${readmePath}

You can now review project.md and generate a comprehensive README.md based on its contents.`
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `Error documenting project: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
);

// Tool to update or create a README.md file
server.tool(
  "update-readme",
  "Update or create a README.md file with given content",
  {
    projectPath: z.string().describe("Absolute path to the project directory"),
    content: z.string().describe("Content for the README.md file")
  },
  async ({ projectPath, content }) => {
    try {
      // Validate project path
      try {
        const stats = await fs.stat(projectPath);
        if (!stats.isDirectory()) {
          return {
            content: [{ 
              type: "text", 
              text: `Error: The provided path is not a directory: ${projectPath}`
            }],
            isError: true
          };
        }
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `Error: Cannot access directory: ${projectPath}\n${error}`
          }],
          isError: true
        };
      }
      
      // Write the README.md file
      const readmePath = path.join(projectPath, 'README.md');
      await fs.writeFile(readmePath, content);
      
      return {
        content: [{ 
          type: "text", 
          text: `Successfully updated README.md at ${readmePath}`
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `Error updating README: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
);

// Tool to assess README quality
server.tool(
  "assess-readme-quality",
  "Review the quality of the README.md against modern documentation standards",
  {
    projectPath: z.string().describe("Absolute path to the project directory")
  },
  async ({ projectPath }) => {
    try {
      // Validate project path
      try {
        const stats = await fs.stat(projectPath);
        if (!stats.isDirectory()) {
          return {
            content: [{ 
              type: "text", 
              text: `Error: The provided path is not a directory: ${projectPath}`
            }],
            isError: true
          };
        }
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `Error: Cannot access directory: ${projectPath}\n${error}`
          }],
          isError: true
        };
      }
      
      // Read README.md
      const readmePath = path.join(projectPath, 'README.md');
      let readmeContent;
      try {
        readmeContent = await fs.readFile(readmePath, 'utf-8');
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `Error: README.md does not exist at ${readmePath}`
          }],
          isError: true
        };
      }
      
      return {
        content: [{ 
          type: "text", 
          text: `README.md found at ${readmePath} (${readmeContent.length} characters). You can now assess its quality against modern documentation standards.`
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `Error assessing README: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
);

// Resource to access project.md content
server.resource(
  "project-md",
  new ResourceTemplate("project-md://{projectPath}", { list: undefined }),
  { description: "Access the content of the project.md file" },
  async (uri, { projectPath }) => {
    try {
      const resolvedPath = decodeURIComponent(Array.isArray(projectPath) ? projectPath[0] : projectPath);
      const projectMdPath = path.join(resolvedPath, 'project.md');
      
      try {
        // Try to read the project.md
        const content = await fs.readFile(projectMdPath, 'utf-8');
        
        return {
          contents: [{
            uri: uri.href,
            text: content
          }]
        };
      } catch (error) {
        return {
          contents: [{
            uri: uri.href,
            text: `No project.md found at ${projectMdPath}`
          }]
        };
      }
    } catch (error) {
      return {
        contents: [{
          uri: uri.href,
          text: `Error accessing project.md: ${error instanceof Error ? error.message : String(error)}`
        }]
      };
    }
  }
);

// Resource to access README.md if it exists
server.resource(
  "readme",
  new ResourceTemplate("readme://{projectPath}", { list: undefined }),
  { description: "Access the existing README.md file in a project" },
  async (uri, { projectPath }) => {
    try {
      const resolvedPath = decodeURIComponent(Array.isArray(projectPath) ? projectPath[0] : projectPath);
      const readmePath = path.join(resolvedPath, 'README.md');
      
      try {
        // Try to read the README.md
        const content = await fs.readFile(readmePath, 'utf-8');
        
        return {
          contents: [{
            uri: uri.href,
            text: content
          }]
        };
      } catch (error) {
        return {
          contents: [{
            uri: uri.href,
            text: `No README.md found at ${readmePath}`
          }]
        };
      }
    } catch (error) {
      return {
        contents: [{
          uri: uri.href,
          text: `Error accessing README: ${error instanceof Error ? error.message : String(error)}`
        }]
      };
    }
  }
);

// Prompt for generating a README
server.prompt(
  "generate-readme",
  {
    projectPath: z.string().describe("Absolute path to the project directory")
  },
  ({ projectPath }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Please generate a comprehensive README.md for the project at ${projectPath}. 
First, read the project.md file which contains all the code from the project. Then, create a modern, well-structured README without using emojis that includes:

1. A clear project title and concise description
2. Installation instructions
3. Usage examples
4. API documentation (if applicable)
5. Project structure overview
6. Technologies used
7. License information (if available)
8. Contributing guidelines (if appropriate)

Ensure the README follows modern documentation best practices and provides all necessary information for users to understand and use the project.`
      }
    }]
  })
);

// Prompt for assessing README quality
server.prompt(
  "assess-readme",
  {
    projectPath: z.string().describe("Absolute path to the project directory")
  },
  ({ projectPath }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Please assess the quality of the README.md for the project at ${projectPath}.

First, read both the project.md file and the README.md file. Then, evaluate the README against these criteria:

1. Comprehensiveness: Does it cover all essential aspects of the project?
2. Clarity: Is the information clearly presented and easy to understand?
3. Structure: Is it well-organized with appropriate sections?
4. Accuracy: Does it accurately reflect what's in the codebase (as shown in project.md)?
5. Usefulness: Does it provide practical information that helps users?
6. Installation & Usage: Are instructions complete and clear?
7. Modern Standards: Does it follow current documentation best practices?

Provide a detailed assessment with specific recommendations for improvement if needed.`
      }
    }]
  })
);

// Helper function to get paths ignored by git
interface IgnoredPathsResult {
  ignoredPaths: Set<string>;
}

async function getGitIgnoredPaths(projectPath: string): Promise<IgnoredPathsResult> {
  const ignoredPaths = new Set<string>();

  try {
    // Check if it's a git repository
    try {
      await fs.access(path.join(projectPath, '.git'));
    } catch (error) {
      // Not a git repository, return empty set
      return { ignoredPaths };
    }

    // Get ignored files from git status
    const { stdout } = await execAsync('git ls-files --ignored --exclude-standard --others', {
      cwd: projectPath
    });

    stdout.split('\n').filter(Boolean).forEach(file => {
      ignoredPaths.add(path.join(projectPath, file));
    });

    // Parse .gitignore for directories
    try {
      const gitignorePath = path.join(projectPath, '.gitignore');
      const gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');

      // Add directly specified directories
      const ignoredDirs = gitignoreContent
        .split('\n')
        .filter(line => line && !line.startsWith('#'))
        .map(line => line.trim())
        .filter(pattern => !pattern.includes('*') && !pattern.startsWith('!'));

      for (const dir of ignoredDirs) {
        try {
          const fullPath = path.join(projectPath, dir);
          const stats = await fs.stat(fullPath);
          if (stats.isDirectory()) {
            ignoredPaths.add(fullPath);
          }
        } catch (error) {
          // Path doesn't exist or can't be accessed, skip it
        }
      }
    } catch (error) {
      // No .gitignore file or error reading it, continue without it
    }

    // Always ignore .git and node_modules directories
    ignoredPaths.add(path.join(projectPath, '.git'));
    ignoredPaths.add(path.join(projectPath, 'node_modules'));

  } catch (error) {
    console.error('Error getting git ignored paths:', error);
    // Default to ignoring standard directories if git fails
    ignoredPaths.add(path.join(projectPath, '.git'));
    ignoredPaths.add(path.join(projectPath, 'node_modules'));
  }

  return { ignoredPaths };
}

// Helper function to collect code files in a directory recursively
interface CollectCodeFilesOptions {
  dirPath: string;
  ignoredPaths: Set<string>;
  files?: string[];
}

async function collectCodeFiles({ dirPath, ignoredPaths, files = [] }: CollectCodeFilesOptions): Promise<string[]> {
  // Skip if the directory is in ignoredPaths
  if (ignoredPaths.has(dirPath)) {
    return files;
  }
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      // Skip if the path is in ignoredPaths
      if (ignoredPaths.has(fullPath)) {
        continue;
      }
      
      if (entry.isDirectory()) {
        // Recursively collect files from subdirectories
        await collectCodeFiles({ dirPath: fullPath, ignoredPaths, files });
      } else if (isCodeFile(entry.name)) {
        // Add code files to the list
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error);
  }
  
  return files;
}

// Helper function to check if a file is a code file
function isCodeFile(filename: string): boolean {
  const codeExtensions: string[] = [
    // Web
    '.html', '.css', '.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte',
    // Backend
    '.py', '.java', '.rb', '.php', '.go', '.rs', '.c', '.cpp', '.cs', '.h', '.hpp',
    // Data/Config
    '.json', '.yml', '.yaml', '.toml', '.ini', '.xml', '.env',
    // Other
    '.md', '.sh', '.bat', '.ps1', '.sql', '.graphql'
  ];
  
  const ext: string = path.extname(filename);
  return codeExtensions.includes(ext);
}

// Helper function to generate project.md content
interface GenerateProjectMdOptions {
  projectPath: string;
  codeFiles: string[];
}

interface FileContentResult {
  relativePath: string;
  content: string;
  error?: string;
}

async function generateProjectMd({ projectPath, codeFiles }: GenerateProjectMdOptions): Promise<string> {
  let content = '# Project Code Summary\n\n';
  
  // Sort files for consistent output
  codeFiles.sort();
  
  const fileContents: FileContentResult[] = await Promise.all(
    codeFiles.map(async (file): Promise<FileContentResult> => {
      try {
        const relativePath = path.relative(projectPath, file);
        const fileContent = await fs.readFile(file, 'utf-8');
        
        return {
          relativePath,
          content: `## ${relativePath}\n\n\`\`\`${getLanguageFromExtension(file)}\n${fileContent}\n\`\`\`\n\n`
        };
      } catch (error) {
        return {
          relativePath: path.relative(projectPath, file),
          content: `## ${path.relative(projectPath, file)}\n\n*Error reading file: ${error instanceof Error ? error.message : String(error)}*\n\n`,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    })
  );

  for (const fileContent of fileContents) {
    content += fileContent.content;
  }
  
  return content;
}

// Helper function to get language identifier for code fence
interface LanguageMap {
  [extension: string]: string;
}

function getLanguageFromExtension(filename: string): string {
  const ext: string = path.extname(filename).toLowerCase();
  
  const languageMap: LanguageMap = {
    '.js': 'javascript',
    '.jsx': 'jsx',
    '.ts': 'typescript',
    '.tsx': 'tsx',
    '.html': 'html',
    '.css': 'css',
    '.py': 'python',
    '.java': 'java',
    '.rb': 'ruby',
    '.php': 'php',
    '.go': 'go',
    '.rs': 'rust',
    '.c': 'c',
    '.cpp': 'cpp',
    '.cs': 'csharp',
    '.json': 'json',
    '.yml': 'yaml',
    '.yaml': 'yaml',
    '.md': 'markdown',
    '.sh': 'bash',
    '.bat': 'batch',
    '.ps1': 'powershell',
    '.sql': 'sql',
    '.vue': 'vue',
    '.svelte': 'svelte',
    '.graphql': 'graphql',
    '.xml': 'xml',
    '.toml': 'toml',
  };
  
  return languageMap[ext] || '';
}

// Start the server with stdio transport
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("ProjectDocumenter MCP Server started successfully with stdio transport");
  } catch (error) {
    console.error("Error starting MCP server:", error);
    process.exit(1);
  }
}

main();