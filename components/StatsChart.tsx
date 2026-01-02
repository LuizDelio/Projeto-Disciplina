import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { DailyLog } from '../types';

interface StatsChartProps {
  logs: DailyLog[];
}

const StatsChart: React.FC<StatsChartProps> = ({ logs }) => {
  // Process logs to get last 7 days points
  const getData = () => {
    const data = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateString = date.toISOString().split('T')[0];
      
      const dayLogs = logs.filter(l => l.date === dateString && l.status === 'completed');
      const totalPoints = dayLogs.reduce((acc, curr) => acc + curr.pointsChange, 0);
      
      data.push({
        name: date.toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 3),
        points: totalPoints,
        fullDate: dateString
      });
    }
    return data;
  };

  const data = getData();

  return (
    <div className="h-64 w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis 
            dataKey="name" 
            stroke="#64748b" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false} 
          />
          <YAxis 
            hide 
          />
          <Tooltip 
            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
            contentStyle={{ 
              backgroundColor: '#1e293b', 
              borderColor: '#334155', 
              color: '#f1f5f9',
              borderRadius: '8px'
            }}
            itemStyle={{ color: '#22c55e' }}
            formatter={(value: number) => [`${value} pts`, 'Pontos']}
            labelFormatter={(label) => label.toUpperCase()}
          />
          <Bar dataKey="points" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.points > 0 ? '#22c55e' : '#334155'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default StatsChart;