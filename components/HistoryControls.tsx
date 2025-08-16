"use client"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Undo2, Redo2, History } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface HistoryControlsProps {
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  historySize: number
}

export function HistoryControls({ canUndo, canRedo, onUndo, onRedo, historySize }: HistoryControlsProps) {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        <div className="flex items-center gap-1 mr-2">
          <History className="h-3 w-3 text-muted-foreground" />
          <Badge variant="outline" className="text-xs h-5">
            {historySize}
          </Badge>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              onClick={onUndo}
              disabled={!canUndo}
              className="h-8 px-2 bg-transparent"
            >
              <Undo2 className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Undo (Ctrl+Z)</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              onClick={onRedo}
              disabled={!canRedo}
              className="h-8 px-2 bg-transparent"
            >
              <Redo2 className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Redo (Ctrl+Y)</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
