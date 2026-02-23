import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, AlertTriangle, CheckCircle, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { useState } from "react";
import type { BreakoutSignal, PatternAnalysis, AIValidation } from "@/types/breakout-signal";

interface PatternDisplayProps {
  signal: BreakoutSignal;
}

export function PatternDisplay({ signal }: PatternDisplayProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [aiValidation, setAiValidation] = useState<AIValidation | undefined>(signal.ai_validation);

  // Parse patterns if stored as string
  let patterns: PatternAnalysis | null = null;
  try {
    if (signal.detected_patterns) {
      patterns = typeof signal.detected_patterns === 'string'
        ? JSON.parse(signal.detected_patterns)
        : signal.detected_patterns;
    }
  } catch (e) {
    console.error('Error parsing patterns:', e);
  }

  // If no full patterns object but we have pattern name and confidence, create a simple display
  const hasSimplePattern = signal.pattern && signal.pattern_confidence;
  
  const handleAIValidation = async () => {
    setIsValidating(true);
    
    try {
      const direction = signal.predicted_direction === 'UP' ? 'bullish' : 'bearish';
      
      const response = await fetch('/api/validate-breakout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: signal.symbol,
          direction: direction,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setAiValidation({
          status: 'completed',
          verdict: result.validation.verdict,
          confidence: result.validation.confidence,
          reasoning: result.validation.reasoning,
          risk_factors: result.validation.risk_factors,
          entry_suggestion: result.validation.entry_suggestion,
          validated_at: result.validation.validated_at,
        });
      } else {
        alert('AI validation failed: ' + result.error);
      }
    } catch (error) {
      console.error('AI validation error:', error);
      alert('Failed to validate signal');
    } finally {
      setIsValidating(false);
    }
  };

  const getConfidenceColor = (conf: number) => {
    if (conf >= 80) return "bg-green-100 text-green-800 border-green-300";
    if (conf >= 65) return "bg-yellow-100 text-yellow-800 border-yellow-300";
    return "bg-orange-100 text-orange-800 border-orange-300";
  };

  const getPatternIcon = (direction: string) => {
    return direction === 'bullish' ? (
      <TrendingUp className="h-3 w-3" />
    ) : direction === 'bearish' ? (
      <TrendingDown className="h-3 w-3" />
    ) : null;
  };

  const getVerdictColor = (verdict: string) => {
    switch (verdict) {
      case 'TRUE_POSITIVE':
        return 'border-green-500 bg-green-50';
      case 'FALSE_POSITIVE':
        return 'border-red-500 bg-red-50';
      case 'WEAK_UNCONFIRMED':
        return 'border-yellow-500 bg-yellow-50';
      default:
        return 'border-gray-300 bg-gray-50';
    }
  };

  const getVerdictIcon = (verdict: string) => {
    switch (verdict) {
      case 'TRUE_POSITIVE':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'FALSE_POSITIVE':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'WEAK_UNCONFIRMED':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      default:
        return null;
    }
  };

  if (!patterns || !patterns.strongest) {
    // If we have simple pattern data, display it
    if (hasSimplePattern) {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {signal.pattern}
            </Badge>
            {signal.pattern_confidence && (
              <span className="text-xs text-muted-foreground">
                {(signal.pattern_confidence * 100).toFixed(0)}% confidence
              </span>
            )}
          </div>
        </div>
      );
    }
    
    return (
      <div className="text-xs text-muted-foreground">
        No chart patterns detected
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Pattern Info */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge 
            variant="outline" 
            className={`${getConfidenceColor(patterns.aggregate_confidence)} flex items-center gap-1`}
          >
            {getPatternIcon(patterns.strongest.direction)}
            <span className="font-semibold">{patterns.strongest.pattern.replace(/_/g, ' ')}</span>
          </Badge>
          
          <span className="text-xs text-muted-foreground">
            {patterns.aggregate_confidence}% confidence
          </span>

          {patterns.confluence && (
            <Badge variant="secondary" className="text-xs">
              +{patterns.total_patterns - 1} More
            </Badge>
          )}
        </div>

        {/* Pattern Type Badge */}
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs capitalize">
            {patterns.strongest.type}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {patterns.strongest.description}
          </span>
        </div>

        {/* Additional Patterns (if confluence) */}
        {patterns.confluence && patterns.detected && patterns.detected.length > 1 && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              View all {patterns.total_patterns} patterns
            </summary>
            <div className="mt-2 space-y-1 pl-4 border-l-2 border-muted">
              {patterns.detected.slice(1).map((p, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {p.pattern.replace(/_/g, ' ')}
                  </Badge>
                  <span className="text-muted-foreground">
                    {p.confidence}%
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* AI Validation Section */}
      <div className="pt-2 border-t">
        {!aiValidation || !aiValidation.status ? (
          <Button
            size="sm"
            variant="outline"
            onClick={handleAIValidation}
            disabled={isValidating}
            className="w-full"
          >
            {isValidating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Validating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                AI Validate Signal
              </>
            )}
          </Button>
        ) : aiValidation.status === 'pending' ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>AI validation in progress...</span>
          </div>
        ) : aiValidation.status === 'completed' && aiValidation.verdict ? (
          <Card className={`border ${getVerdictColor(aiValidation.verdict)}`}>
            <CardContent className="p-3 space-y-2">
              {/* Verdict Header */}
              <div className="flex items-center gap-2">
                {getVerdictIcon(aiValidation.verdict)}
                <span className="text-sm font-semibold">
                  {aiValidation.verdict.replace(/_/g, ' ')}
                </span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {Math.round((aiValidation.confidence || 0) * 100)}% confidence
                </span>
              </div>

              {/* Reasoning */}
              <p className="text-xs text-gray-700 leading-relaxed">
                {aiValidation.reasoning}
              </p>

              {/* Risk Factors */}
              {aiValidation.risk_factors && aiValidation.risk_factors.length > 0 && (
                <div className="text-xs space-y-1">
                  <div className="font-semibold text-gray-700">Risk Factors:</div>
                  <ul className="list-disc list-inside space-y-0.5 text-gray-600">
                    {aiValidation.risk_factors.map((factor, idx) => (
                      <li key={idx}>{factor}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Entry Suggestion */}
              {aiValidation.entry_suggestion && (
                <div className="text-xs pt-2 border-t">
                  <div className="font-semibold text-gray-700 mb-1">Suggestion:</div>
                  <p className="text-gray-600">{aiValidation.entry_suggestion}</p>
                </div>
              )}

              {/* Timestamp */}
              {aiValidation.validated_at && (
                <div className="text-xs text-muted-foreground pt-1 border-t">
                  Validated: {new Date(aiValidation.validated_at).toLocaleTimeString()}
                </div>
              )}
            </CardContent>
          </Card>
        ) : aiValidation.status === 'error' ? (
          <div className="text-xs text-red-600 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span>AI validation failed. Try again later.</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
