import React from 'react';
import { useNavigate } from 'react-router-dom';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { DashboardData } from '../../types/dashboard';
import {
  dashboardListPath,
  leadsStagePath,
  opportunitiesStagePath,
} from '../../utils/dashboardNavigation';

interface SalesPipelineCardProps {
  data: DashboardData;
  onNavigateUnmigrated: (moduleName: string) => void;
}

function formatMoney(amount: number | undefined, currency = 'INR'): string {
  const num = Number(amount || 0);
  return `${currency} ${num.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export const SalesPipelineCard: React.FC<SalesPipelineCardProps> = ({
  data,
  onNavigateUnmigrated: _onNavigateUnmigrated,
}) => {
  void _onNavigateUnmigrated;
  const navigate = useNavigate();
  const currency = data.defaultCurrency || 'INR';
  const opps = data.opportunitiesSummary;
  const totalValue = Number(
    opps?.totalPipelineValue ?? opps?.pipelineValue ?? 0
  );
  const weightedValue = Number(
    opps?.weightedForecastValue ?? opps?.weightedForecast ?? 0
  );
  const wonValue = Number(opps?.wonValue ?? 0);
  const totalCount = Number(opps?.totalOpportunities ?? 0);
  const wonCount = Number(opps?.wonCount ?? data.wonLeads ?? 0);

  const stages =
    Array.isArray(opps?.byStage) && opps.byStage.length > 0
      ? opps.byStage
      : [];

  const conversionPct =
    totalCount + wonCount > 0
      ? Math.round((wonCount / (totalCount + wonCount)) * 100)
      : 0;

  return (
    <div
      data-tour="dashboard-pipeline"
      className="bg-white border border-zinc-300 rounded-xl p-6 flex-1 flex flex-col justify-between"
    >
      <div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-semibold text-zinc-950 m-0 leading-tight">
              Sales Pipeline & Deal Progression
            </h3>
            <p className="text-xs text-zinc-500 m-0 mt-1">
              Active pipeline revenue, probability-weighted forecast, and conversion.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(opps?.source === 'leads' ? '/leads' : '/opportunities')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-950 hover:text-zinc-600 bg-transparent border-none cursor-pointer transition-colors"
          >
            <span>{opps?.source === 'leads' ? 'Leads Board' : 'Pipeline Board'}</span>
            <ArrowForwardIcon sx={{ fontSize: 13 }} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 p-4 bg-zinc-50 border border-zinc-200 rounded-lg mb-6">
          <button
            type="button"
            onClick={() =>
              navigate(opps?.source === 'leads' ? '/leads' : dashboardListPath('opportunities'))
            }
            className="text-left bg-transparent border-0 p-0 cursor-pointer hover:opacity-80"
          >
            <span className="text-[11px] font-medium text-zinc-500 block mb-0.5">
              Total Pipeline
            </span>
            <div className="text-lg font-bold font-mono text-zinc-950">
              {formatMoney(totalValue, currency)}
            </div>
            <span className="text-[11px] text-zinc-400">
              {totalCount} open deals
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              navigate(opps?.source === 'leads' ? '/leads' : dashboardListPath('opportunities'))
            }
            className="text-left bg-transparent border-0 p-0 cursor-pointer hover:opacity-80"
          >
            <span className="text-[11px] font-medium text-zinc-500 block mb-0.5">
              Weighted Forecast
            </span>
            <div className="text-lg font-bold font-mono text-zinc-950">
              {formatMoney(weightedValue, currency)}
            </div>
            <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-0.5">
              <TrendingUpIcon sx={{ fontSize: 12 }} /> Expected Revenue
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              navigate(
                opps?.source === 'leads'
                  ? dashboardListPath('leadsWon')
                  : dashboardListPath('opportunitiesWon')
              )
            }
            className="text-left bg-transparent border-0 p-0 cursor-pointer hover:opacity-80"
          >
            <span className="text-[11px] font-medium text-zinc-500 block mb-0.5">
              Closed Won
            </span>
            <div className="text-lg font-bold font-mono text-emerald-600">
              {formatMoney(wonValue, currency)}
            </div>
            <span className="text-[11px] text-zinc-400">
              {wonCount} deals converted
            </span>
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {stages.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-200 px-4 py-6 text-center text-xs text-zinc-500">
              No open pipeline value yet. Add opportunity deal amounts or lead expected revenue to
              populate this chart.
            </div>
          ) : (
            stages.map((stg) => {
              const pct =
                totalValue > 0
                  ? Math.min(100, Math.round(((Number(stg.value) || 0) / totalValue) * 100))
                  : 0;
              return (
                <button
                  type="button"
                  key={stg.stage}
                  onClick={() =>
                    navigate(
                      opps?.source === 'leads'
                        ? leadsStagePath(String(stg.stage))
                        : opportunitiesStagePath(String(stg.stage))
                    )
                  }
                  className="w-full text-left bg-transparent border-0 p-0 cursor-pointer hover:opacity-90"
                  title={`View ${stg.stage} deals`}
                >
                  <div className="flex justify-between items-center mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-zinc-900">{stg.stage}</span>
                      <span className="text-[11px] text-zinc-400">({stg.count} deals)</span>
                    </div>
                    <span className="text-xs font-semibold font-mono text-zinc-950">
                      {formatMoney(stg.value, currency)}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-zinc-950 rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 mt-6 border-t border-zinc-200">
        <span className="text-xs text-zinc-500">
          Conversion rate across pipeline is running at{' '}
          <strong className="text-zinc-950">{conversionPct}%</strong>
        </span>
        <button
          type="button"
          onClick={() => navigate('/quotations')}
          className="text-xs text-zinc-600 hover:text-zinc-950 font-medium bg-transparent border-none cursor-pointer"
        >
          View Quotes
        </button>
      </div>
    </div>
  );
};
