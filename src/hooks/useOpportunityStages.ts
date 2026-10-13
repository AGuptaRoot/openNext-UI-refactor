import { useEffect, useState } from 'react';
import { crmApi } from '../services/api';
import {
  buildOpportunityStages,
  OPPORTUNITY_STAGES,
} from '../types/opportunities';

export type OpportunityStageOption = (typeof OPPORTUNITY_STAGES)[number];

/**
 * Loads opportunity stages from the active Opportunity Pipeline
 * (fallback: settings opportunity_stages, then built-in defaults).
 */
export function useOpportunityStages() {
  const [stages, setStages] = useState<OpportunityStageOption[]>(OPPORTUNITY_STAGES);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const active = await crmApi.getActiveOpportunityPipeline();
        const pipelineStages = active.data?.stages;
        if (!cancelled && Array.isArray(pipelineStages) && pipelineStages.length) {
          const names = pipelineStages.map((s) => s.label).filter(Boolean);
          const probs: Record<string, number> = {};
          for (const stage of pipelineStages) {
            probs[stage.label] = Number(stage.probability) || 50;
          }
          setStages(buildOpportunityStages(names, probs));
          return;
        }
      } catch {
        /* fall through to settings */
      }

      try {
        const res = await crmApi.getOpportunityPipelineSettings();
        if (cancelled) return;
        setStages(
          buildOpportunityStages(
            res.data?.opportunity_stages,
            res.data?.opportunity_stage_probabilities
          )
        );
      } catch {
        if (!cancelled) setStages(OPPORTUNITY_STAGES);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return stages;
}
