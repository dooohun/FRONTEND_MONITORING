import React, { useEffect, useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { RefreshCw, Calendar, GitBranch, Users, Trophy, TrendingUp, MessageSquare, GitCommit, GitPullRequest } from "lucide-react";
import { useRouter } from "next/router";

interface PerformanceData {
  id: string;
  name: string;
  github_id: string;
  track_name: string;
  commits_count: number;
  prs_count: number;
  review_comments_count: number;
  total_comments_count: number;
  pr_comments_count: number;
}

interface GitHubTeamDashboardProps {
  initialData: PerformanceData[];
  selectedYear: string;
  selectedMonth: string;
}

interface RankedData extends PerformanceData {
  score: number;
}

interface ChartData {
  name: string;
  commits: number;
  prs: number;
  comments: number;
}

interface SyncStatus {
  type: "loading" | "success" | "error";
  message: string;
  details?: {
    processedPRs: number;
    totalComments: number;
  };
}
interface TableProps {
  children: React.ReactNode;
}

interface TableCellProps {
  children: React.ReactNode;
  className?: string;
}

const Table: React.FC<TableProps> = ({ children, ...props }) => (
  <div className="w-full overflow-auto">
    <table className="w-full caption-bottom text-sm" {...props}>
      {children}
    </table>
  </div>
);

const TableHeader: React.FC<TableProps> = ({ children }) => <thead className="[&_tr]:border-b">{children}</thead>;

const TableBody: React.FC<TableProps> = ({ children }) => <tbody className="[&_tr:last-child]:border-0">{children}</tbody>;

const TableRow: React.FC<TableCellProps> = ({ children, className = "" }) => (
  <tr className={`border-b transition-colors hover:bg-muted/50 ${className}`}>{children}</tr>
);

const TableHead: React.FC<TableCellProps> = ({ children, className = "" }) => (
  <th className={`h-12 px-4 text-left align-middle font-medium text-muted-foreground ${className}`}>{children}</th>
);

const TableCell: React.FC<TableCellProps> = ({ children, className = "" }) => <td className={`p-4 align-middle ${className}`}>{children}</td>;

const YEARS: string[] = ["2025", "2026"];
const MONTHS: Array<{ value: string; label: string }> = [
  { value: "01", label: "1월" },
  { value: "02", label: "2월" },
  { value: "03", label: "3월" },
  { value: "04", label: "4월" },
  { value: "05", label: "5월" },
  { value: "06", label: "6월" },
  { value: "07", label: "7월" },
  { value: "08", label: "8월" },
  { value: "09", label: "9월" },
  { value: "10", label: "10월" },
  { value: "11", label: "11월" },
  { value: "12", label: "12월" },
];
const TRACKS: string[] = ["Frontend Track", "Backend Track", "Android Track", "iOS Track"];
const REPOS: Record<string, string[]> = {
  "Frontend Track": ["KOIN_WEB_RECODE", "KOIN_ORDER_WEBVIEW", "KOIN_OWNER_WEB", "B_BOT", "BCSD_INTERNAL_WEB", "KOIN_ADMIN_V2", "KONECT_FRONT_END"],
  "Android Track": ["KOIN_ANDROID", "BCSD_INTERNAL_MOBILE"],
  "iOS Track": [],
  "Backend Track": ["KOIN_API_V2"],
};

const GitHubTeamDashboard = ({ initialData, selectedYear, selectedMonth }: GitHubTeamDashboardProps) => {
  const thisYear = new Date().getFullYear();
  const thisMonth = String(new Date().getMonth() + 1).padStart(2, "0");
  const [isPending, startTransition] = useTransition();
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<string>(TRACKS[0]);
  const [selectedSyncTrack, setSelectedSyncTrack] = useState<string>(TRACKS[0]);
  const [selectedRepo, setSelectedRepo] = useState<string>(REPOS[selectedTrack][0]);
  const [selectedSyncYear, setSelectedSyncYear] = useState<string>(String(thisYear));
  const [selectedSyncMonth, setSelectedSyncMonth] = useState<string>(thisMonth);

  const [performanceData, setPerformanceData] = useState<PerformanceData[]>(initialData.filter((member) => member.track_name === selectedTrack));

  const router = useRouter();

  const handleYearChange = (year: string) => {
    router.push(
      {
        pathname: router.pathname,
        query: { ...router.query, year, month: selectedMonth },
      },
      undefined,
      { shallow: false }
    );
  };

  const handleMonthChange = (month: string) => {
    router.push(
      {
        pathname: router.pathname,
        query: { ...router.query, year: selectedYear, month },
      },
      undefined,
      { shallow: false }
    );
  };

  const handleSync = (): void => {
    const targetMonth = `${selectedSyncYear}-${selectedSyncMonth}`;

    startTransition(async () => {
      setSyncStatus({ type: "loading", message: "GitHub 데이터를 동기화하는 중..." });

      try {
        const response = await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            month: targetMonth,
            repoOwner: "BCSDLab",
            repoName: selectedRepo,
          }),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          setSyncStatus({
            type: "success",
            message: result.message,
            details: result.data,
          });
          setTimeout(() => window.location.reload(), 2000);
        } else {
          setSyncStatus({
            type: "error",
            message: result.error || "Sync failed",
          });
        }
      } catch (error) {
        setSyncStatus({
          type: "error",
          message: "Network error occurred",
        });
      }
    });
  };

  const handleChangeTrack = (track: string) => {
    setSelectedTrack(track);
    const filteredData = initialData.filter((member) => member.track_name === track);
    setPerformanceData(filteredData);
  };

  const handleChangeSyncTrack = (track: string) => {
    setSelectedSyncTrack(track);
    setSelectedRepo(REPOS[track][0]);
  };

  const chartData: ChartData[] = performanceData.map((member) => ({
    name: member.name,
    commits: member.commits_count,
    prs: member.prs_count,
    comments: member.total_comments_count,
  }));

  const rankedData: RankedData[] = [...performanceData]
    .map((member) => ({
      ...member,
      score: member.commits_count + member.prs_count * 2 + member.total_comments_count,
    }))
    .sort((a, b) => b.score - a.score);

  const getRankBadge = (index: number) => {
    if (index === 0) return <Badge className="bg-yellow-100 text-yellow-800">🥇 1위</Badge>;
    if (index === 1) return <Badge className="bg-gray-100 text-gray-800">🥈 2위</Badge>;
    if (index === 2) return <Badge className="bg-orange-100 text-orange-800">🥉 3위</Badge>;
    return <Badge variant="outline">{index + 1}위</Badge>;
  };

  const totalCommits: number = performanceData.reduce((sum, member) => sum + member.commits_count, 0);
  const totalPRs: number = performanceData.reduce((sum, member) => sum + member.prs_count, 0);
  const totalComments: number = performanceData.reduce((sum, member) => sum + member.total_comments_count, 0);

  useEffect(() => {
    const filteredData = initialData.filter((member) => member.track_name === selectedTrack);
    setPerformanceData(filteredData);
  }, [initialData, selectedTrack]);

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">GitHub Team Dashboard</h1>
            <p className="text-muted-foreground mt-1">BCSDLab 조직의 팀 성과 분석 대시보드</p>
          </div>
          <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
            <div className="flex self-end gap-1">
              <Calendar className="h-4 w-4" />
              {selectedYear}년 {selectedMonth}월
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedYear} onValueChange={handleYearChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}년
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedMonth} onValueChange={handleMonthChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              동기화 설정
            </CardTitle>
            <CardDescription>GitHub 레포지토리와 기간을 선택하여 데이터를 동기화합니다.- 에러 발생 시 관리자에게 문의하세요.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">트랙</label>
                <Select value={selectedSyncTrack} onValueChange={handleChangeSyncTrack}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRACKS.map((track) => (
                      <SelectItem key={track} value={track}>
                        {track}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">레포지토리</label>
                <Select value={selectedRepo} onValueChange={setSelectedRepo}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPOS[selectedSyncTrack].map((repo) => (
                      <SelectItem key={repo} value={repo}>
                        {repo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">년도</label>
                <Select value={selectedSyncYear} onValueChange={setSelectedSyncYear}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map((year) => (
                      <SelectItem key={year} value={year}>
                        {year}년
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">월</label>
                <Select value={selectedSyncMonth} onValueChange={setSelectedSyncMonth}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((month) => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleSync} disabled={isPending} className="flex items-center gap-2">
                <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
                {isPending ? "동기화 중..." : "동기화"}
              </Button>
            </div>

            {syncStatus && (
              <Alert
                className={`mt-4 ${
                  syncStatus.type === "success"
                    ? "border-green-200 bg-green-50"
                    : syncStatus.type === "error"
                    ? "border-red-200 bg-red-50"
                    : "border-blue-200 bg-blue-50"
                }`}
              >
                <AlertDescription>
                  {syncStatus.message}
                  {syncStatus.details && (
                    <div className="mt-1 text-sm">
                      PR: {syncStatus.details.processedPRs}개, 코멘트: {syncStatus.details.totalComments}개 처리됨
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader className="flex justify-between">
          <div className="flex flex-col gap-2">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />팀 성과 차트
            </CardTitle>
            <CardDescription>
              {selectedYear}년 {selectedMonth}월 팀원별 활동 현황
            </CardDescription>
          </div>
          <Select value={selectedTrack} onValueChange={handleChangeTrack}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="트랙 선택" />
              <SelectContent>
                {TRACKS.map((track) => (
                  <SelectItem key={track} value={track}>
                    {track}
                  </SelectItem>
                ))}
              </SelectContent>
            </SelectTrigger>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-45} textAnchor="end" height={80} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="commits" fill="hsl(var(--primary))" name="커밋" />
                <Bar dataKey="prs" fill="hsl(var(--secondary))" name="PR" />
                <Bar dataKey="comments" fill="hsl(var(--accent))" name="코멘트" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 커밋</CardTitle>
            <GitCommit className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCommits}</div>
            <p className="text-xs text-muted-foreground">이번 달 전체 커밋 수</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 PR</CardTitle>
            <GitPullRequest className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPRs}</div>
            <p className="text-xs text-muted-foreground">이번 달 전체 PR 수</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 코멘트</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalComments}</div>
            <p className="text-xs text-muted-foreground">이번 달 전체 코멘트 수</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">활성 멤버</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{performanceData.length}</div>
            <p className="text-xs text-muted-foreground">활동한 팀원 수</p>
          </CardContent>
        </Card>
      </div>

      {/* Ranking Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            이달의 우수 개발자
          </CardTitle>
          <CardDescription>커밋, PR, 코멘트 활동을 종합한 순위입니다 (가중치: 커밋×1 + PR×2 + 코멘트×1)</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">순위</TableHead>
                <TableHead>이름</TableHead>
                <TableHead>트랙</TableHead>
                <TableHead className="text-right">커밋</TableHead>
                <TableHead className="text-right">PR</TableHead>
                <TableHead className="text-right">리뷰 코멘트</TableHead>
                <TableHead className="text-right">받은 코멘트</TableHead>
                <TableHead className="text-right">총점</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rankedData.map((member, index) => (
                <TableRow key={member.id} className={index < 3 ? "bg-muted/30" : ""}>
                  <TableCell>{getRankBadge(index)}</TableCell>
                  <TableCell className="font-medium">
                    <div>
                      <div>{member.name}</div>
                      <div className="text-sm text-muted-foreground">@{member.github_id}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{member.track_name}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">{member.commits_count}</TableCell>
                  <TableCell className="text-right font-mono">{member.prs_count}</TableCell>
                  <TableCell className="text-right font-mono">{member.review_comments_count}</TableCell>
                  <TableCell className="text-right font-mono">{member.pr_comments_count}</TableCell>
                  <TableCell className="text-right font-mono font-bold">{member.score}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default GitHubTeamDashboard;
