import { Link } from 'react-router-dom'
import { Lightbulb, Sparkles, ArrowUpRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface AIInsightPanelProps {
  title?: string
  insights: string[]
  ctaTo?: string
  ctaLabel?: string
}

export function AIInsightPanel({
  title = 'مساعد الذكاء الاصطناعي',
  insights,
  ctaTo = '/analyzer',
  ctaLabel = 'تنفيذ التحليل الآن',
}: AIInsightPanelProps) {
  return (
    <Card className="glass border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {insights.map((insight, idx) => (
          <div key={`${insight}-${idx}`} className="flex items-start gap-2 text-sm text-muted-foreground">
            <Lightbulb className="w-3.5 h-3.5 mt-0.5 text-yellow-500" />
            <span>{insight}</span>
          </div>
        ))}
        <Link to={ctaTo}>
          <Button variant="outline" size="sm" className="mt-2 gap-2">
            <ArrowUpRight className="w-3 h-3" />
            {ctaLabel}
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}
