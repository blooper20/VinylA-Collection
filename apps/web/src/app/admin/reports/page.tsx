'use client';

import React, { useEffect, useState } from 'react';
import { supabase, ListeningLogWithAlbum } from '@vinyla/core-api';
import styles from './reports.module.css';
import { SpinSocialModal } from '../../../components/Modal/SpinSocialModal';

type TabType = 'log' | 'comment';

interface ReportData {
  REPORT_ID: number;
  REASON: string;
  DETAILS: string | null;
  CREATED_AT: string;
  CONTENT_ID: number;
  CONTENT_TEXT: string;
  IS_HIDDEN: boolean;
  REPORTER_ID: string;
  LOG_ID: number;
}

export default function AdminReportsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('log');
  const [reports, setReports] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalData, setModalData] = useState<{ entry: ListeningLogWithAlbum, ownerName: string | null } | null>(null);

  useEffect(() => {
    fetchReports(activeTab);
  }, [activeTab]);

  const fetchReports = async (tab: TabType) => {
    setLoading(true);
    try {
      if (tab === 'log') {
        const { data, error } = await supabase
          .from('SPIN_LOG_REPORT')
          .select(`
            REPORT_ID, REASON, DETAILS, CREATED_AT, REPORTER_ID, LOG_ID,
            LISTENING_LOG:LOG_ID(NOTE, IS_PUBLIC)
          `)
          .order('CREATED_AT', { ascending: false });
        
        if (error) throw error;
        
        setReports((data || []).map((item: any) => ({
          REPORT_ID: item.REPORT_ID,
          REASON: item.REASON,
          DETAILS: item.DETAILS,
          CREATED_AT: item.CREATED_AT,
          CONTENT_ID: item.LOG_ID,
          CONTENT_TEXT: item.LISTENING_LOG?.NOTE || '(내용 없음)',
          IS_HIDDEN: item.LISTENING_LOG?.IS_PUBLIC === false,
          REPORTER_ID: item.REPORTER_ID,
          LOG_ID: item.LOG_ID
        })));
      } else {
        const { data, error } = await supabase
          .from('SPIN_COMMENT_REPORT')
          .select(`
            REPORT_ID, REASON, DETAILS, CREATED_AT, REPORTER_ID, COMMENT_ID,
            SPIN_LOG_COMMENT:COMMENT_ID(LOG_ID, CONTENT, IS_HIDDEN)
          `)
          .order('CREATED_AT', { ascending: false });
          
        if (error) throw error;

        setReports((data || []).map((item: any) => ({
          REPORT_ID: item.REPORT_ID,
          REASON: item.REASON,
          DETAILS: item.DETAILS,
          CREATED_AT: item.CREATED_AT,
          CONTENT_ID: item.COMMENT_ID,
          CONTENT_TEXT: item.SPIN_LOG_COMMENT?.CONTENT || '(내용 없음)',
          IS_HIDDEN: item.SPIN_LOG_COMMENT?.IS_HIDDEN === true,
          REPORTER_ID: item.REPORTER_ID,
          LOG_ID: item.SPIN_LOG_COMMENT?.LOG_ID
        })));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (report: ReportData) => {
    if (!confirm('이 콘텐츠를 다시 공개 처리하시겠습니까?')) return;
    
    try {
      if (activeTab === 'log') {
        await supabase.from('LISTENING_LOG').update({ IS_PUBLIC: true }).eq('LOG_ID', report.CONTENT_ID);
      } else {
        await supabase.from('SPIN_LOG_COMMENT').update({ IS_HIDDEN: false }).eq('COMMENT_ID', report.CONTENT_ID);
      }
      alert('공개 처리되었습니다.');
      fetchReports(activeTab);
    } catch (e) {
      alert('오류가 발생했습니다.');
    }
  };

  const handleHide = async (report: ReportData) => {
    if (!confirm('이 콘텐츠를 강제 비공개 처리하시겠습니까?')) return;
    
    try {
      if (activeTab === 'log') {
        await supabase.from('LISTENING_LOG').update({ IS_PUBLIC: false }).eq('LOG_ID', report.CONTENT_ID);
      } else {
        await supabase.from('SPIN_LOG_COMMENT').update({ IS_HIDDEN: true }).eq('COMMENT_ID', report.CONTENT_ID);
      }
      alert('비공개 처리되었습니다.');
      fetchReports(activeTab);
    } catch (e) {
      alert('오류가 발생했습니다.');
    }
  };

  const handleViewOriginal = async (logId: number) => {
    try {
      const { data, error } = await supabase
        .from('LISTENING_LOG')
        .select('*, ALBUM_MASTER(*)')
        .eq('LOG_ID', logId)
        .single();
      
      if (error) throw error;
      setModalData({ entry: data as ListeningLogWithAlbum, ownerName: '원본 글 작성자' });
    } catch (e) {
      alert('원본 글을 불러오는 중 오류가 발생했습니다. (삭제되었을 수 있습니다.)');
    }
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>신고 관리</h2>

      <div className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === 'log' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('log')}
        >
          다이어리 신고
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'comment' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('comment')}
        >
          댓글 신고
        </button>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: '15%' }}>접수일시</th>
              <th style={{ width: '25%' }}>신고 사유</th>
              <th style={{ width: '35%' }}>원본 콘텐츠</th>
              <th style={{ width: '10%' }}>현재 상태</th>
              <th style={{ width: '15%' }}>액션</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '40px' }}>데이터를 불러오는 중입니다...</td>
              </tr>
            ) : reports.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '40px' }}>접수된 신고가 없습니다.</td>
              </tr>
            ) : (
              reports.map((r) => (
                <tr key={r.REPORT_ID}>
                  <td>
                    {new Date(r.CREATED_AT).toLocaleDateString('ko-KR')}<br/>
                    <span style={{ fontSize: '11px', color: '#666' }}>
                      {new Date(r.CREATED_AT).toLocaleTimeString('ko-KR')}
                    </span>
                  </td>
                  <td>
                    <span className={styles.reasonBadge}>{r.REASON}</span>
                    {r.DETAILS && (
                      <div className={styles.details}>
                        {r.DETAILS}
                      </div>
                    )}
                  </td>
                  <td>
                    <div className={styles.contentPreview}>
                      {r.CONTENT_TEXT}
                    </div>
                  </td>
                  <td>
                    <span className={`${styles.statusBadge} ${r.IS_HIDDEN ? styles.statusHidden : styles.statusPublic}`}>
                      {r.IS_HIDDEN ? '비공개됨' : '공개 상태'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <button className={styles.actionButton} style={{ background: '#444', color: '#fff' }} onClick={() => handleViewOriginal(r.LOG_ID)}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>open_in_new</span>
                        원문 보기
                      </button>
                      {r.IS_HIDDEN ? (
                        <button className={styles.actionButton} onClick={() => handleRestore(r)}>
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>visibility</span>
                          복구 (공개)
                        </button>
                      ) : (
                        <button className={styles.actionButton} style={{ background: '#333', color: '#fff' }} onClick={() => handleHide(r)}>
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>visibility_off</span>
                          강제 비공개
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalData && (
        <SpinSocialModal
          entry={modalData.entry}
          ownerName={modalData.ownerName}
          onClose={() => setModalData(null)}
        />
      )}
    </div>
  );
}
