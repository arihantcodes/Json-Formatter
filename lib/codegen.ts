import type { ApiRequest } from "./api"
import type { RequestCollection } from "./collection"

export interface CodeGenOptions {
  language: string
  framework?: string
  includeComments: boolean
  useEnvironmentVariables: boolean
  indentSize: number
  indentType: "spaces" | "tabs"
}

export interface GeneratedCode {
  code: string
  language: string
  framework?: string
  filename: string
  dependencies?: string[]
}

export class CodeGenerator {
  private static indent(level: number, options: CodeGenOptions): string {
    const char = options.indentType === "tabs" ? "\t" : " ".repeat(options.indentSize)
    return char.repeat(level)
  }

  private static formatHeaders(headers: Record<string, string>, options: CodeGenOptions, level = 1): string {
    const entries = Object.entries(headers).filter(([_, value]) => value)
    if (entries.length === 0) return "{}"

    const indent = this.indent(level, options)
    const baseIndent = this.indent(level - 1, options)

    return "{\n" + entries.map(([key, value]) => `${indent}"${key}": "${value}"`).join(",\n") + `\n${baseIndent}}`
  }

  private static escapeString(str: string): string {
    return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r")
  }

  static generateJavaScriptFetch(request: ApiRequest, options: CodeGenOptions): GeneratedCode {
    const { url, method, headers, body } = request
    const indent = this.indent(1, options)
    const hasBody = method !== "GET" && body

    let code = ""

    if (options.includeComments) {
      code += `// Generated API request using fetch\n`
      code += `// Method: ${method}\n`
      code += `// URL: ${url}\n\n`
    }

    code += `const response = await fetch("${url}", {\n`
    code += `${indent}method: "${method}",\n`

    if (Object.keys(headers).length > 0) {
      code += `${indent}headers: ${this.formatHeaders(headers, options, 2)},\n`
    }

    if (hasBody) {
      code += `${indent}body: ${method === "POST" && headers["Content-Type"]?.includes("json") ? "JSON.stringify(" : '"'}${this.escapeString(body || "")}${method === "POST" && headers["Content-Type"]?.includes("json") ? ")" : '"'}\n`
    }

    code += `});\n\n`

    if (options.includeComments) {
      code += `// Handle the response\n`
    }

    code += `if (response.ok) {\n`
    code += `${indent}const data = await response.json();\n`
    code += `${indent}console.log(data);\n`
    code += `} else {\n`
    code += `${indent}console.error('Request failed:', response.status, response.statusText);\n`
    code += `}`

    return {
      code,
      language: "javascript",
      filename: "api-request.js",
      dependencies: [],
    }
  }

  static generateNodeJS(request: ApiRequest, options: CodeGenOptions): GeneratedCode {
    const { url, method, headers, body } = request
    const indent = this.indent(1, options)
    const hasBody = method !== "GET" && body

    let code = ""

    if (options.includeComments) {
      code += `// Generated Node.js API request using fetch\n`
      code += `// Install: npm install node-fetch (if Node.js < 18)\n\n`
    }

    code += `const fetch = require('node-fetch'); // Remove if Node.js >= 18\n\n`

    code += `async function makeRequest() {\n`
    code += `${indent}try {\n`
    code += `${this.indent(2, options)}const response = await fetch("${url}", {\n`
    code += `${this.indent(3, options)}method: "${method}",\n`

    if (Object.keys(headers).length > 0) {
      code += `${this.indent(3, options)}headers: ${this.formatHeaders(headers, options, 4)},\n`
    }

    if (hasBody) {
      code += `${this.indent(3, options)}body: ${method === "POST" && headers["Content-Type"]?.includes("json") ? "JSON.stringify(" : '"'}${this.escapeString(body || "")}${method === "POST" && headers["Content-Type"]?.includes("json") ? ")" : '"'}\n`
    }

    code += `${this.indent(2, options)}});\n\n`
    code += `${this.indent(2, options)}if (response.ok) {\n`
    code += `${this.indent(3, options)}const data = await response.json();\n`
    code += `${this.indent(3, options)}console.log(data);\n`
    code += `${this.indent(3, options)}return data;\n`
    code += `${this.indent(2, options)}} else {\n`
    code += `${this.indent(3, options)}throw new Error(\`Request failed: \${response.status} \${response.statusText}\`);\n`
    code += `${this.indent(2, options)}}\n`
    code += `${indent}} catch (error) {\n`
    code += `${this.indent(2, options)}console.error('Error:', error.message);\n`
    code += `${this.indent(2, options)}throw error;\n`
    code += `${indent}}\n`
    code += `}\n\n`
    code += `makeRequest();`

    return {
      code,
      language: "javascript",
      framework: "nodejs",
      filename: "api-request.js",
      dependencies: ["node-fetch"],
    }
  }

  static generatePython(request: ApiRequest, options: CodeGenOptions): GeneratedCode {
    const { url, method, headers, body } = request
    const indent = this.indent(1, options)
    const hasBody = method !== "GET" && body

    let code = ""

    if (options.includeComments) {
      code += `# Generated Python API request using requests\n`
      code += `# Install: pip install requests\n\n`
    }

    code += `import requests\nimport json\n\n`

    code += `def make_request():\n`
    code += `${indent}url = "${url}"\n`

    if (Object.keys(headers).length > 0) {
      code += `${indent}headers = {\n`
      Object.entries(headers)
        .filter(([_, value]) => value)
        .forEach(([key, value]) => {
          code += `${this.indent(2, options)}"${key}": "${value}",\n`
        })
      code += `${indent}}\n`
    }

    if (hasBody) {
      if (headers["Content-Type"]?.includes("json")) {
        code += `${indent}data = ${JSON.stringify(JSON.parse(body || "{}"), null, options.indentSize)}\n`
      } else {
        code += `${indent}data = "${this.escapeString(body || "")}"\n`
      }
    }

    code += `\n${indent}try:\n`
    code += `${this.indent(2, options)}response = requests.${method.toLowerCase()}(\n`
    code += `${this.indent(3, options)}url,\n`

    if (Object.keys(headers).length > 0) {
      code += `${this.indent(3, options)}headers=headers,\n`
    }

    if (hasBody) {
      if (headers["Content-Type"]?.includes("json")) {
        code += `${this.indent(3, options)}json=data\n`
      } else {
        code += `${this.indent(3, options)}data=data\n`
      }
    }

    code += `${this.indent(2, options)})\n\n`
    code += `${this.indent(2, options)}response.raise_for_status()\n`
    code += `${this.indent(2, options)}return response.json()\n\n`
    code += `${indent}except requests.exceptions.RequestException as e:\n`
    code += `${this.indent(2, options)}print(f"Request failed: {e}")\n`
    code += `${this.indent(2, options)}raise\n\n`

    if (options.includeComments) {
      code += `# Execute the request\n`
    }

    code += `if __name__ == "__main__":\n`
    code += `${indent}result = make_request()\n`
    code += `${indent}print(json.dumps(result, indent=2))`

    return {
      code,
      language: "python",
      filename: "api_request.py",
      dependencies: ["requests"],
    }
  }

  static generateCurl(request: ApiRequest, options: CodeGenOptions): GeneratedCode {
    const { url, method, headers, body } = request
    const hasBody = method !== "GET" && body

    let code = ""

    if (options.includeComments) {
      code += `# Generated cURL command\n`
      code += `# Copy and paste into terminal\n\n`
    }

    code += `curl -X ${method} \\\n`
    code += `  "${url}"`

    Object.entries(headers)
      .filter(([_, value]) => value)
      .forEach(([key, value]) => {
        code += ` \\\n  -H "${key}: ${value}"`
      })

    if (hasBody) {
      code += ` \\\n  -d '${body}'`
    }

    return {
      code,
      language: "bash",
      filename: "api-request.sh",
      dependencies: [],
    }
  }

  static generatePHP(request: ApiRequest, options: CodeGenOptions): GeneratedCode {
    const { url, method, headers, body } = request
    const indent = this.indent(1, options)
    const hasBody = method !== "GET" && body

    let code = ""

    if (options.includeComments) {
      code += `<?php\n// Generated PHP API request using cURL\n\n`
    } else {
      code += `<?php\n\n`
    }

    code += `function makeRequest() {\n`
    code += `${indent}$url = "${url}";\n`
    code += `${indent}$ch = curl_init();\n\n`

    code += `${indent}curl_setopt_array($ch, [\n`
    code += `${this.indent(2, options)}CURLOPT_URL => $url,\n`
    code += `${this.indent(2, options)}CURLOPT_RETURNTRANSFER => true,\n`
    code += `${this.indent(2, options)}CURLOPT_CUSTOMREQUEST => "${method}",\n`

    if (Object.keys(headers).length > 0) {
      code += `${this.indent(2, options)}CURLOPT_HTTPHEADER => [\n`
      Object.entries(headers)
        .filter(([_, value]) => value)
        .forEach(([key, value]) => {
          code += `${this.indent(3, options)}"${key}: ${value}",\n`
        })
      code += `${this.indent(2, options)}],\n`
    }

    if (hasBody) {
      code += `${this.indent(2, options)}CURLOPT_POSTFIELDS => '${this.escapeString(body || "")}',\n`
    }

    code += `${indent}]);\n\n`

    code += `${indent}$response = curl_exec($ch);\n`
    code += `${indent}$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);\n`
    code += `${indent}$error = curl_error($ch);\n`
    code += `${indent}curl_close($ch);\n\n`

    code += `${indent}if ($error) {\n`
    code += `${this.indent(2, options)}throw new Exception("cURL Error: " . $error);\n`
    code += `${indent}}\n\n`

    code += `${indent}if ($httpCode >= 400) {\n`
    code += `${this.indent(2, options)}throw new Exception("HTTP Error: " . $httpCode);\n`
    code += `${indent}}\n\n`

    code += `${indent}return json_decode($response, true);\n`
    code += `}\n\n`

    if (options.includeComments) {
      code += `// Execute the request\n`
    }

    code += `try {\n`
    code += `${indent}$result = makeRequest();\n`
    code += `${indent}echo json_encode($result, JSON_PRETTY_PRINT);\n`
    code += `} catch (Exception $e) {\n`
    code += `${indent}echo "Error: " . $e->getMessage();\n`
    code += `}`

    return {
      code,
      language: "php",
      filename: "api_request.php",
      dependencies: [],
    }
  }

  static generateGo(request: ApiRequest, options: CodeGenOptions): GeneratedCode {
    const { url, method, headers, body } = request
    const indent = this.indent(1, options)
    const hasBody = method !== "GET" && body

    let code = ""

    if (options.includeComments) {
      code += `// Generated Go API request\n`
      code += `// go mod init api-request && go run main.go\n\n`
    }

    code += `package main\n\n`
    code += `import (\n`
    code += `${indent}"bytes"\n`
    code += `${indent}"encoding/json"\n`
    code += `${indent}"fmt"\n`
    code += `${indent}"io"\n`
    code += `${indent}"net/http"\n`
    code += `)\n\n`

    code += `func makeRequest() error {\n`
    code += `${indent}url := "${url}"\n`

    if (hasBody) {
      code += `${indent}payload := []byte(\`${body}\`)\n`
      code += `${indent}req, err := http.NewRequest("${method}", url, bytes.NewBuffer(payload))\n`
    } else {
      code += `${indent}req, err := http.NewRequest("${method}", url, nil)\n`
    }

    code += `${indent}if err != nil {\n`
    code += `${this.indent(2, options)}return fmt.Errorf("error creating request: %w", err)\n`
    code += `${indent}}\n\n`

    if (Object.keys(headers).length > 0) {
      Object.entries(headers)
        .filter(([_, value]) => value)
        .forEach(([key, value]) => {
          code += `${indent}req.Header.Set("${key}", "${value}")\n`
        })
      code += `\n`
    }

    code += `${indent}client := &http.Client{}\n`
    code += `${indent}resp, err := client.Do(req)\n`
    code += `${indent}if err != nil {\n`
    code += `${this.indent(2, options)}return fmt.Errorf("error making request: %w", err)\n`
    code += `${indent}}\n`
    code += `${indent}defer resp.Body.Close()\n\n`

    code += `${indent}body, err := io.ReadAll(resp.Body)\n`
    code += `${indent}if err != nil {\n`
    code += `${this.indent(2, options)}return fmt.Errorf("error reading response: %w", err)\n`
    code += `${indent}}\n\n`

    code += `${indent}if resp.StatusCode >= 400 {\n`
    code += `${this.indent(2, options)}return fmt.Errorf("HTTP error %d: %s", resp.StatusCode, string(body))\n`
    code += `${indent}}\n\n`

    code += `${indent}var result interface{}\n`
    code += `${indent}if err := json.Unmarshal(body, &result); err != nil {\n`
    code += `${this.indent(2, options)}fmt.Println("Raw response:", string(body))\n`
    code += `${indent}} else {\n`
    code += `${this.indent(2, options)}prettyJSON, _ := json.MarshalIndent(result, "", "  ")\n`
    code += `${this.indent(2, options)}fmt.Println(string(prettyJSON))\n`
    code += `${indent}}\n\n`

    code += `${indent}return nil\n`
    code += `}\n\n`

    code += `func main() {\n`
    code += `${indent}if err := makeRequest(); err != nil {\n`
    code += `${this.indent(2, options)}fmt.Printf("Error: %v\\n", err)\n`
    code += `${indent}}\n`
    code += `}`

    return {
      code,
      language: "go",
      filename: "main.go",
      dependencies: [],
    }
  }

  static generateCode(request: ApiRequest, options: CodeGenOptions): GeneratedCode {
    switch (options.language) {
      case "javascript":
        return options.framework === "nodejs"
          ? this.generateNodeJS(request, options)
          : this.generateJavaScriptFetch(request, options)
      case "python":
        return this.generatePython(request, options)
      case "curl":
        return this.generateCurl(request, options)
      case "php":
        return this.generatePHP(request, options)
      case "go":
        return this.generateGo(request, options)
      default:
        throw new Error(`Unsupported language: ${options.language}`)
    }
  }

  static getSupportedLanguages(): Array<{ value: string; label: string; frameworks?: string[] }> {
    return [
      {
        value: "javascript",
        label: "JavaScript",
        frameworks: ["browser", "nodejs"],
      },
      {
        value: "python",
        label: "Python",
      },
      {
        value: "curl",
        label: "cURL",
      },
      {
        value: "php",
        label: "PHP",
      },
      {
        value: "go",
        label: "Go",
      },
    ]
  }

  // Export functionality
  static exportToPostmanCollection(collection: RequestCollection): string {
    const postmanCollection = {
      info: {
        name: collection.name,
        description: collection.description || "",
        schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
      },
      item: collection.requests.map((request) => ({
        name: request.name,
        request: {
          method: request.method,
          header: Object.entries(request.headers).map(([key, value]) => ({
            key,
            value,
            type: "text",
          })),
          url: {
            raw: request.url,
            host: [new URL(request.url).hostname],
            path: new URL(request.url).pathname.split("/").filter(Boolean),
          },
          body: request.body
            ? {
                mode: "raw",
                raw: request.body,
                options: {
                  raw: {
                    language: "json",
                  },
                },
              }
            : undefined,
        },
        response: [],
      })),
      variable: collection.variables.map((variable) => ({
        key: variable.key,
        value: variable.value,
        type: "string",
      })),
    }

    return JSON.stringify(postmanCollection, null, 2)
  }

  static exportToOpenAPI(collection: RequestCollection): string {
    const openApiSpec = {
      openapi: "3.0.0",
      info: {
        title: collection.name,
        description: collection.description || "",
        version: "1.0.0",
      },
      servers: [
        {
          url: "https://api.example.com",
          description: "API Server",
        },
      ],
      paths: {} as Record<string, any>,
    }

    collection.requests.forEach((request) => {
      try {
        const url = new URL(request.url)
        const path = url.pathname
        const method = request.method.toLowerCase()

        if (!openApiSpec.paths[path]) {
          openApiSpec.paths[path] = {}
        }

        openApiSpec.paths[path][method] = {
          summary: request.name,
          description: request.description || "",
          parameters: request.queryParams
            ?.filter((p) => p.enabled)
            .map((param) => ({
              name: param.key,
              in: "query",
              required: false,
              schema: {
                type: "string",
              },
              example: param.value,
            })),
          requestBody:
            request.body && method !== "get"
              ? {
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                      },
                      example: request.body,
                    },
                  },
                }
              : undefined,
          responses: {
            "200": {
              description: "Successful response",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                  },
                },
              },
            },
          },
        }
      } catch (error) {
        console.warn(`Failed to process request ${request.name}:`, error)
      }
    })

    return JSON.stringify(openApiSpec, null, 2)
  }
}
