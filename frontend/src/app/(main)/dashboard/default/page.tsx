import { DashboardActions } from "./_components/dashboard-actions";
import { MetricCards } from "./_components/metric-cards";
import { PipelineStatus } from "./_components/pipeline-status";
import { RecentPiecesCard } from "./_components/recent-pieces-card";

export default function Page() {
  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      <DashboardActions />
      <MetricCards />
      <PipelineStatus />
      <RecentPiecesCard />
    </div>
  );
}
