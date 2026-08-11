'use client'

import { Component } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const FRIENDLY_MESSAGES = {
  default: 'Something went wrong. Please try again.',
  network: 'Unable to connect. Check your internet connection and try again.',
  auth: 'Your session may have expired. Please refresh the page or log in again.',
  notFound: 'The requested resource could not be found.',
}

export class GlobalErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dentos:unhandled-error', {
        detail: { message: error?.message, stack: error?.stack },
      }))
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    this.props.onRetry?.()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      const message = this.props.message || FRIENDLY_MESSAGES.default
      const suggestion = this.props.recoverySuggestion || 'If the problem persists, contact support or try refreshing the page.'

      return (
        <Card className="border-destructive/30 bg-destructive/5 m-4">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle className="text-base">{this.props.title || 'Something went wrong'}</CardTitle>
            </div>
            <CardDescription>{message}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{suggestion}</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={this.handleRetry}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Try again
              </Button>
              <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
                Refresh page
              </Button>
            </div>
            {process.env.NODE_ENV !== 'production' && this.state.error && (
              <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                {this.state.error.message}
              </pre>
            )}
          </CardContent>
        </Card>
      )
    }
    return this.props.children
  }
}

/** Lightweight fallback for API errors with retry. */
export function RetryErrorFallback({ error, onRetry, title = 'Failed to load', suggestion }) {
  const message = error?.message || FRIENDLY_MESSAGES.default
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center gap-4">
      <AlertTriangle className="h-10 w-10 text-muted-foreground" />
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground mt-1">{message}</p>
        {suggestion && <p className="text-xs text-muted-foreground mt-2">{suggestion}</p>}
      </div>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Retry
        </Button>
      )}
    </div>
  )
}

export { FRIENDLY_MESSAGES }
