'use client';

import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
  Cell,
} from 'recharts';
import {
  EVENT_COLOR,
  EVENT_LABEL,
  ACCENT_LINE,
  ACCENT_FILL,
  BAR_GOLD,
  BAR_BLUE,
  GRID_COLOR,
  AXIS_COLOR,
  TOOLTIP_STYLE,
  CATEGORICAL,
} from './chartTheme';

const axisProps = {
  stroke: AXIS_COLOR,
  fontSize: 11,
  tickLine: false,
  axisLine: { stroke: GRID_COLOR },
} as const;

const shortDate = (d: string) => d.slice(5).replace('-', '/');

// ── 1. 가입자 추이 (단일 시리즈 area — 제목이 시리즈명, 범례 없음) ──
export const SignupAreaChart = ({ data }: { data: { date: string; count: number }[] }) => (
  <ResponsiveContainer width="100%" height="100%">
    <AreaChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
      <CartesianGrid stroke={GRID_COLOR} vertical={false} />
      <XAxis dataKey="date" {...axisProps} tickFormatter={shortDate} minTickGap={28} />
      <YAxis {...axisProps} allowDecimals={false} width={46} />
      <Tooltip
        contentStyle={TOOLTIP_STYLE}
        labelStyle={{ color: '#8e9192' }}
        formatter={(v: any) => [`${v}명`, '신규 가입']}
        cursor={{ stroke: GRID_COLOR }}
      />
      <Area
        type="monotone"
        dataKey="count"
        stroke={ACCENT_LINE}
        strokeWidth={2}
        fill={ACCENT_FILL}
        dot={false}
        activeDot={{ r: 4 }}
      />
    </AreaChart>
  </ResponsiveContainer>
);

// ── 2. API 사용량 (이벤트 타입별 multi-line, 고정 색 매핑 + 범례) ──
export const EventMultiLineChart = ({
  data,
  eventTypes,
}: {
  data: Record<string, number | string>[];
  eventTypes: string[];
}) => (
  <ResponsiveContainer width="100%" height="100%">
    <LineChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
      <CartesianGrid stroke={GRID_COLOR} vertical={false} />
      <XAxis dataKey="date" {...axisProps} tickFormatter={shortDate} minTickGap={28} />
      <YAxis {...axisProps} allowDecimals={false} width={46} />
      <Tooltip
        contentStyle={TOOLTIP_STYLE}
        labelStyle={{ color: '#8e9192' }}
        formatter={(v: any, name: any) => [v, EVENT_LABEL[name] || name]}
        cursor={{ stroke: GRID_COLOR }}
      />
      <Legend
        formatter={(name: string) => (
          <span style={{ color: '#c4c7c8', fontSize: 12 }}>{EVENT_LABEL[name] || name}</span>
        )}
        iconType="plainline"
      />
      {eventTypes.map((t, i) => (
        <Line
          key={t}
          type="monotone"
          dataKey={t}
          stroke={EVENT_COLOR[t] || CATEGORICAL[i % CATEGORICAL.length]}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      ))}
    </LineChart>
  </ResponsiveContainer>
);

// ── 3. 장르 분포 Top 10 (horizontal bar, 단일 골드, 직접 값 라벨) ──
export const GenreBarChart = ({ data }: { data: { genre: string; count: number }[] }) => (
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 0 }}>
      <XAxis type="number" hide />
      <YAxis
        type="category"
        dataKey="genre"
        {...axisProps}
        width={96}
        tick={{ fill: '#c4c7c8', fontSize: 12 }}
      />
      <Tooltip
        contentStyle={TOOLTIP_STYLE}
        labelStyle={{ color: '#8e9192' }}
        formatter={(v: any) => [`${v}장`, '보유']}
        cursor={{ fill: 'rgba(255,255,255,0.04)' }}
      />
      <Bar dataKey="count" fill={BAR_GOLD} radius={[0, 4, 4, 0]} barSize={16}>
        <LabelList dataKey="count" position="right" style={{ fill: '#c4c7c8', fontSize: 11 }} />
      </Bar>
    </BarChart>
  </ResponsiveContainer>
);

// ── 4. 컬렉션 규모 분포 (histogram column, 단일 블루) ──
export const CollectionHistogram = ({ data }: { data: { bucket: string; users: number }[] }) => (
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={data} margin={{ top: 16, right: 12, left: -18, bottom: 0 }}>
      <CartesianGrid stroke={GRID_COLOR} vertical={false} />
      <XAxis dataKey="bucket" {...axisProps} interval={0} />
      <YAxis {...axisProps} allowDecimals={false} width={46} />
      <Tooltip
        contentStyle={TOOLTIP_STYLE}
        labelStyle={{ color: '#8e9192' }}
        formatter={(v: any) => [`${v}명`, '사용자']}
        cursor={{ fill: 'rgba(255,255,255,0.04)' }}
      />
      <Bar dataKey="users" radius={[4, 4, 0, 0]} barSize={32}>
        <LabelList dataKey="users" position="top" style={{ fill: '#c4c7c8', fontSize: 11 }} />
        {data.map((_, i) => (
          <Cell key={i} fill={BAR_BLUE} />
        ))}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
);
