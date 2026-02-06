"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Lightbulb, Plus } from "lucide-react"
import { SuggestionCard } from "./SuggestionCard"
import type { Suggestion } from "@/types/suggestions"

interface SuggestionsListProps {
  suggestions: Suggestion[]
  loading: boolean
  onView: (id: string) => void
  onCreateNew: () => void
}

export function SuggestionsList({ suggestions, loading, onView, onCreateNew }: SuggestionsListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="classic-spinner" />
      </div>
    )
  }

  if (suggestions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Lightbulb className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">Henüz öneri bulunmuyor</p>
          <Button className="mt-4" onClick={onCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            İlk Öneriyi Oluştur
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {suggestions.map(suggestion => (
        <SuggestionCard
          key={suggestion.id}
          suggestion={suggestion}
          onView={onView}
        />
      ))}
    </div>
  )
}
