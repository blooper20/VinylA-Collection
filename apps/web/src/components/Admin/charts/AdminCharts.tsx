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
  ACCENT_LINE,
  ACCENT_FILL,
  BAR_GOLD,
  BAR_BLUE,
  GRID_COLOR,
  AXIS_COLOR,
  TOOLTIP_STYLE,
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

// ── 3. DAU 추이 (단일 시리즈 area, 블루) ──
export const DauTrendChart = ({ data }: { data: { date: string; count: number }[] }) => (
  <ResponsiveContainer width="100%" height="100%">
    <AreaChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
      <CartesianGrid stroke={GRID_COLOR} vertical={false} />
      <XAxis dataKey="date" {...axisProps} tickFormatter={shortDate} minTickGap={28} />
      <YAxis {...axisProps} allowDecimals={false} width={46} />
      <Tooltip
        contentStyle={TOOLTIP_STYLE}
        labelStyle={{ color: '#8e9192' }}
        formatter={(v: any) => [`${v}명`, '활성 사용자']}
        cursor={{ stroke: GRID_COLOR }}
      />
      <Area
        type="monotone"
        dataKey="count"
        stroke={BAR_BLUE}
        strokeWidth={2}
        fill="rgba(57, 135, 229, 0.15)"
        dot={false}
        activeDot={{ r: 4 }}
      />
    </AreaChart>
  </ResponsiveContainer>
);

// ── 4. 범용 가로 바 (장르/아티스트/문의 카테고리 — 단일색 + 직접 값 라벨) ──
export const HorizontalBarChart = ({
  data,
  color = BAR_GOLD,
  unit = '',
}: {
  data: { label: string; count: number }[];
  color?: string;
  unit?: string;
}) => (
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 0 }}>
      <XAxis type="number" hide />
      <YAxis
        type="category"
        dataKey="label"
        {...axisProps}
        width={110}
        tick={{ fill: '#c4c7c8', fontSize: 12 }}
      />
      <Tooltip
        contentStyle={TOOLTIP_STYLE}
        labelStyle={{ color: '#8e9192' }}
        formatter={(v: any) => [`${v}${unit}`, '']}
        cursor={{ fill: 'rgba(255,255,255,0.04)' }}
      />
      <Bar dataKey="count" fill={color} radius={[0, 4, 4, 0]} barSize={16}>
        <LabelList dataKey="count" position="right" style={{ fill: '#c4c7c8', fontSize: 11 }} />
      </Bar>
    </BarChart>
  </ResponsiveContainer>
);

// ── AI 스캔 요청 수 (일별 성공/실패 스택 바 — 상태 색상: 성공 teal / 실패 red) ──
export const ScanStackedBars = ({
  data,
}: {
  data: { date: string; success: number; fail: number }[];
}) => (
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
      <CartesianGrid stroke={GRID_COLOR} vertical={false} />
      <XAxis dataKey="date" {...axisProps} tickFormatter={shortDate} minTickGap={28} />
      <YAxis {...axisProps} allowDecimals={false} width={46} />
      <Tooltip
        contentStyle={TOOLTIP_STYLE}
        labelStyle={{ color: '#8e9192' }}
        formatter={(v: any, name: any) => [v, name === 'success' ? '성공' : '실패']}
        cursor={{ fill: 'rgba(255,255,255,0.04)' }}
      />
      <Legend
        formatter={(name: string) => (
          <span style={{ color: '#c4c7c8', fontSize: 12 }}>{name === 'success' ? '성공' : '실패'}</span>
        )}
      />
      <Bar dataKey="success" stackId="scan" fill="#199e70" stroke="#131313" strokeWidth={1} />
      <Bar dataKey="fail" stackId="scan" fill="#e66767" stroke="#131313" strokeWidth={1} radius={[4, 4, 0, 0]} />
    </BarChart>
  </ResponsiveContainer>
);

// ── AI 스캔 성공률 (%) — 단일 시리즈 라인, 데이터 없는 날은 끊김 ──
export const ScanSuccessRateLine = ({
  data,
}: {
  data: { date: string; rate: number | null }[];
}) => (
  <ResponsiveContainer width="100%" height="100%">
    <LineChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
      <CartesianGrid stroke={GRID_COLOR} vertical={false} />
      <XAxis dataKey="date" {...axisProps} tickFormatter={shortDate} minTickGap={28} />
      <YAxis {...axisProps} domain={[0, 100]} tickFormatter={(v: any) => `${v}%`} width={46} />
      <Tooltip
        contentStyle={TOOLTIP_STYLE}
        labelStyle={{ color: '#8e9192' }}
        formatter={(v: any) => [`${v}%`, '성공률']}
        cursor={{ stroke: GRID_COLOR }}
      />
      <Line
        type="monotone"
        dataKey="rate"
        stroke="#199e70"
        strokeWidth={2}
        dot={{ r: 2 }}
        activeDot={{ r: 4 }}
        connectNulls={false}
      />
    </LineChart>
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
