import { Card } from '@/components/ui/card'

export default function ModuleComingSoon({ title, description, icon: Icon }) {
  return (
    <div className="max-w-lg mx-auto pt-8">
      <Card className="p-8 text-center bg-card border-border rounded-lg">
        {Icon ? (
          <div className="w-12 h-12 rounded-xl bg-[#0D9488]/10 flex items-center justify-center mx-auto mb-4">
            <Icon className="w-6 h-6 text-[#0D9488]" />
          </div>
        ) : null}
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground mt-2">{description}</p>
        <p className="text-xs text-muted-foreground mt-4 uppercase tracking-wide">Coming soon</p>
      </Card>
    </div>
  )
}
