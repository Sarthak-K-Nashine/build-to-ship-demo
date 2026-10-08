import React, { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api.js';
import { CAT_COLOR, CHART, Card, Loading, PageHeader, Stat, catLabel } from '../ui.jsx';

export default function Dashboard() {
  const [s, setS] = useState(null);
  useEffect(() => {
    let alive = true;
    const load = () => api.get('/api/stats').then((r) => alive && setS(r.data));
    load();
    const t = setInterval(load, 5000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  if (!s) return <Loading label="Loading dashboard…" />;

  const axis = { tick: CHART.tick, axisLine: false, tickLine: false };
  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Overview of every request screened by PromptShield. Includes sample history for the demo account."
        actions={<span className="inline-flex items-center gap-1.5 text-xs text-mute"><span className="h-1.5 w-1.5 rounded-full bg-[#17b26a]" />Refreshes every 5 seconds</span>} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Requests screened" value={s.total?.toLocaleString()} />
        <Stat label="Blocked" value={s.blocked?.toLocaleString()} dot="bg-[#f04438]" hint={`${s.blockRate}% of traffic`} />
        <Stat label="Redacted" value={s.redacted?.toLocaleString()} dot="bg-[#f79009]" hint="Personal data masked" />
        <Stat label="Allowed" value={s.allowed?.toLocaleString()} dot="bg-[#17b26a]" hint="Passed clean" />
        <Stat label="Avg. overhead" value={s.avgGuardMs != null ? `${s.avgGuardMs} ms` : null} hint={s.avgAiMs ? `Gemini path ${s.avgAiMs} ms` : 'Regex path'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card title="Decisions per day" className="lg:col-span-3">
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={s.days} barCategoryGap="30%">
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="day" {...axis} /><YAxis allowDecimals={false} {...axis} width={32} />
                <Tooltip {...CHART.tooltip} /><Legend {...CHART.legend} />
                <Bar dataKey="BLOCKED" name="Blocked" stackId="a" fill="#f04438" />
                <Bar dataKey="REDACTED" name="Redacted" stackId="a" fill="#f79009" />
                <Bar dataKey="ALLOWED" name="Allowed" stackId="a" fill="#17b26a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Threats by category" className="lg:col-span-2">
          {s.byCategory.length === 0 ? <p className="py-28 text-center text-sm text-mute">No threats recorded yet.</p> : (
            <div className="h-72">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={s.byCategory.map((c) => ({ ...c, label: catLabel(c.name) }))} dataKey="value" nameKey="label" innerRadius={62} outerRadius={92} paddingAngle={1.5} stroke="#fff" strokeWidth={2}>
                    {s.byCategory.map((c) => <Cell key={c.name} fill={CAT_COLOR[c.name] || '#98a2b3'} />)}
                  </Pie>
                  <Tooltip {...CHART.tooltip} /><Legend {...CHART.legend} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <Card title="Personal data masked, by type">
        {s.pii.length === 0 ? <p className="text-sm text-mute">No personal data detected yet.</p> : (
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={s.pii} layout="vertical" margin={{ left: 20 }} barCategoryGap="30%">
                <CartesianGrid stroke={CHART.grid} horizontal={false} />
                <XAxis type="number" allowDecimals={false} {...axis} /><YAxis type="category" dataKey="name" {...axis} width={100} />
                <Tooltip {...CHART.tooltip} /><Bar dataKey="value" name="Items" fill="#2557d6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}
