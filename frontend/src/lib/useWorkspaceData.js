import { useCallback, useEffect, useState } from 'react';
import * as dashboardMock from '../data/dashboard';
import * as threatsMock from '../data/threats';
import { RECENT_COMMUNITY_REPORTS } from '../data/reports';
import { api, BackendUnavailable } from './api';

const DASHBOARD_MOCK = {
  live: false,
  OVERVIEW_STATS: dashboardMock.OVERVIEW_STATS,
  DAILY_DETECTIONS: dashboardMock.DAILY_DETECTIONS,
  THREAT_DISTRIBUTION: dashboardMock.THREAT_DISTRIBUTION,
  RISK_BREAKDOWN: dashboardMock.RISK_BREAKDOWN,
  SCAN_HISTORY: dashboardMock.SCAN_HISTORY,
  RECENT_REPORTS: dashboardMock.RECENT_REPORTS,
  ACTIVITY_FEED: dashboardMock.ACTIVITY_FEED,
  WATCHLIST: dashboardMock.WATCHLIST,
};

export function useDashboardData() {
  const [data, setData] = useState(DASHBOARD_MOCK);
  useEffect(() => {
    let active = true;
    api.dashboard().then(
      (result) => {
        if (!active) return;
        setData({
          live: true,
          OVERVIEW_STATS: result.overviewStats,
          DAILY_DETECTIONS: result.dailyDetections,
          THREAT_DISTRIBUTION: result.threatDistribution,
          RISK_BREAKDOWN: result.riskBreakdown,
          SCAN_HISTORY: result.scanHistory,
          RECENT_REPORTS: result.recentReports,
          ACTIVITY_FEED: result.activityFeed,
          WATCHLIST: result.watchlist,
        });
      },
      () => {},
    );
    return () => {
      active = false;
    };
  }, []);
  return data;
}

const THREAT_MOCK = {
  live: false,
  THREAT_RECORDS: threatsMock.THREAT_RECORDS,
  THREAT_STATS: threatsMock.THREAT_STATS,
  THREAT_CATEGORIES: threatsMock.THREAT_CATEGORIES,
  THREAT_ACTIVITY_14D: threatsMock.THREAT_ACTIVITY_14D,
  EMERGING_CAMPAIGNS: threatsMock.EMERGING_CAMPAIGNS,
  REPORTER_LEADERBOARD: threatsMock.REPORTER_LEADERBOARD,
  RECENT_COMMUNITY_REPORTS,
};

export function useThreatData() {
  const [data, setData] = useState(THREAT_MOCK);
  const [feedState, setFeedState] = useState('loading');
  const [token, setToken] = useState(0);

  useEffect(() => {
    let active = true;
    api.threats().then(
      (result) => {
        if (!active) return;
        setData({
          live: true,
          THREAT_RECORDS: result.records,
          THREAT_STATS: result.stats,
          THREAT_CATEGORIES: result.categories,
          THREAT_ACTIVITY_14D: result.activity14d,
          EMERGING_CAMPAIGNS: result.campaigns,
          REPORTER_LEADERBOARD: result.leaderboard,
          RECENT_COMMUNITY_REPORTS: result.communityReports,
        });
        setFeedState('ready');
      },
      (error) => {
        if (!active) return;
        if (error instanceof BackendUnavailable) {
          setData(THREAT_MOCK);
          setFeedState('ready');
        } else {
          setFeedState('error');
        }
      },
    );
    return () => {
      active = false;
    };
  }, [token]);

  const reload = useCallback(() => {
    setFeedState('loading');
    setToken((value) => value + 1);
  }, []);

  return { ...data, feedState, reload };
}
