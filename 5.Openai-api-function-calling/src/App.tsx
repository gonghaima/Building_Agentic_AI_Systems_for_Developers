import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import './App.css'

interface Lesson {
  id: number
  title: string
  description: string
  status: 'available' | 'coming-soon'
}

const lessons: Lesson[] = [
  {
    id: 0,
    title: 'Baseline: Basic Chat',
    description: 'Simple chat interface with message history - no function calling yet',
    status: 'available',
  },
  {
    id: 1,
    title: 'Lesson 1: Basic Function Calling',
    description: 'Simple tip calculator demonstrating function calling fundamentals',
    status: 'available',
  },
  {
    id: 2,
    title: 'Lesson 2: External API Integration',
    description: 'Nominatim geocoding API — look up coordinates for cities, addresses, and landmarks',
    status: 'available',
  },
  {
    id: 3,
    title: 'Lesson 3: Multiple Function Calls',
    description: 'Geocoding + OpenWeatherMap — handling multiple tool calls across rounds',
    status: 'available',
  },
  {
    id: 4,
    title: 'Lesson 4: Built-in Tools — Web Search',
    description: 'Use the web_search built-in tool — no back-and-forth loop required',
    status: 'available',
  },
  {
    id: 5,
    title: 'Lesson 5: Streaming Function Calls',
    description: 'Streaming function calls and responses in real-time',
    status: 'available',
  },
  {
    id: 6,
    title: 'Lesson 6: Remote MCP Server',
    description: 'Connect to a remote MCP server for flight search tools',
    status: 'available',
  },
  {
    id: 7,
    title: 'Lesson 7: Building Custom Tools',
    description: 'Create custom tools with custom grammars',
    status: 'coming-soon',
  },
  {
    id: 8,
    title: 'Lesson 8: Calling MCP Servers',
    description: 'Connect to Model Context Protocol servers',
    status: 'coming-soon',
  },
  {
    id: 9,
    title: 'Lesson 9: Advanced MCP',
    description: 'Remote weather data server integration',
    status: 'coming-soon',
  },
]

function App() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">OpenAI Function Calling Course</h1>
        <p className="text-muted-foreground">
          Learn tool and function calling with the OpenAI API through hands-on practice
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {lessons.map((lesson) => (
          <Card key={lesson.id} className={lesson.status === 'coming-soon' ? 'opacity-60' : ''}>
            <CardHeader>
              <CardTitle>{lesson.title}</CardTitle>
              <CardDescription>{lesson.description}</CardDescription>
            </CardHeader>
            <CardContent>
              {lesson.status === 'available' ? (
                lesson.id === 1 || lesson.id === 2 || lesson.id === 3 || lesson.id === 4 || lesson.id === 5 || lesson.id === 6 ? (
                  <Button asChild variant="default" size="sm" className="w-full">
                    <Link to={`/lesson-${String(lesson.id).padStart(2, '0')}/responses`}>
                      Responses API
                    </Link>
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button asChild variant="default" size="sm" className="flex-1">
                      <Link to={`/${lesson.id === 0 ? 'baseline' : `lesson-${String(lesson.id).padStart(2, '0')}`}/responses`}>
                        Responses API
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="flex-1">
                      <Link to={`/${lesson.id === 0 ? 'baseline' : `lesson-${String(lesson.id).padStart(2, '0')}`}/completions`}>
                        Completions API
                      </Link>
                    </Button>
                  </div>
                )
              ) : (
                <Button disabled size="sm" className="w-full">
                  Coming Soon
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default App
