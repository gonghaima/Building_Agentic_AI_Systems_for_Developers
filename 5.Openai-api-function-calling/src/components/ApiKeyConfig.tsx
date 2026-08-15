import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

const API_KEY_STORAGE_KEY = 'openai_api_key'

interface ApiKeyConfigProps {
  onKeyValidated?: (key: string) => void
}

export function ApiKeyConfig({ onKeyValidated }: ApiKeyConfigProps) {
  const [apiKey, setApiKey] = useState('')
  const [isValid, setIsValid] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Check for stored API key on mount
    const stored = localStorage.getItem(API_KEY_STORAGE_KEY)
    if (stored && validateApiKey(stored)) {
      setApiKey(stored)
      setIsValid(true)
      onKeyValidated?.(stored)
    }
  }, [onKeyValidated])

  function validateApiKey(key: string): boolean {
    // Basic validation: should start with 'sk-' and have reasonable length
    return key.startsWith('sk-') && key.length > 20
  }

  function handleSaveKey() {
    setError('')
    
    if (!validateApiKey(apiKey)) {
      setError('Invalid API key format. Key should start with "sk-" and be at least 20 characters.')
      setIsValid(false)
      return
    }

    localStorage.setItem(API_KEY_STORAGE_KEY, apiKey)
    setIsValid(true)
    onKeyValidated?.(apiKey)
  }

  function handleClearKey() {
    localStorage.removeItem(API_KEY_STORAGE_KEY)
    setApiKey('')
    setIsValid(false)
    setError('')
  }

  if (isValid) {
    return (
      <Alert className="mb-4">
        <CheckCircle2 className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>OpenAI API key is configured</span>
          <Button variant="outline" size="sm" onClick={handleClearKey}>
            Clear Key
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4 mb-4">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Please enter your OpenAI API key to continue. Get yours at{' '}
          <a
            href="https://platform.openai.com/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            platform.openai.com/api-keys
          </a>
        </AlertDescription>
      </Alert>

      <div className="flex gap-2">
        <Input
          type="password"
          placeholder="sk-proj-..."
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSaveKey()
            }
          }}
        />
        <Button onClick={handleSaveKey}>Save Key</Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
