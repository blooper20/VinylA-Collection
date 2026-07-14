import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'apps/web/.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('apps/web/.env.local에서 SUPABASE 환경변수를 찾지 못했습니다. 레포 루트에서 실행하세요.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runTest() {
  console.log('--- 테스트 시작: 신고 10회 누적 시 자동 비공개 트리거 ---');
  let testLogId: number | null = null;
  let testAlbumId: number | null = null;
  
  const { data: { users }, error: usersErr } = await supabase.auth.admin.listUsers();
  if (usersErr) {
    console.error('유저 목록을 가져오지 못했습니다.');
    return;
  }
  
  let reporters: string[] = users.map(u => u.id);
  
  if (reporters.length < 10) {
    console.log(`유저가 부족합니다. (${reporters.length}/10). 임시 유저를 생성합니다...`);
    for (let i = reporters.length; i < 10; i++) {
      const { data: newUser } = await supabase.auth.admin.createUser({
        email: `test_reporter_${i}@test.com`,
        password: 'password123',
        email_confirm: true
      });
      if (newUser.user) reporters.push(newUser.user.id);
    }
  }

  const testUserId = reporters[0];

  try {
    // 1. 임시 앨범 생성
    console.log('1. 임시 앨범 생성 중...');
    const { data: album, error: albumErr } = await supabase
      .from('ALBUM_MASTER')
      .insert({
        ALBUM_ID: 9999999, // 임시로 큰 값 사용
        TITLE: 'Test Album for Trigger',
        ARTIST: 'Test Artist',
        RELEASE_YEAR: 2024,
        IMAGE_URL: 'none',
        VINYL_IMAGE_URL: 'none',
        CUSTOM_COLOR_HEX: '#000000',
        CUSTOM_STYLE_TYPE: 'SOLID',
      })
      .select()
      .single();

    if (albumErr) throw new Error('앨범 생성 실패: ' + albumErr.message);
    testAlbumId = album.ALBUM_ID;

    // 2. 임시 스피닝 다이어리(LISTENING_LOG) 생성
    console.log('2. 임시 스피닝 다이어리 생성 중...');
    const { data: log, error: logErr } = await supabase
      .from('LISTENING_LOG')
      .insert({
        USER_ID: testUserId,
        ALBUM_ID: testAlbumId,
        LISTENED_AT: new Date().toISOString(),
        NOTE: '이 글은 트리거 테스트용입니다.',
        IS_PUBLIC: true,
      })
      .select()
      .single();

    if (logErr) throw new Error('다이어리 생성 실패: ' + logErr.message);
    testLogId = log.LOG_ID;
    console.log(`✅ 생성된 다이어리 ID: ${testLogId}, 현재 IS_PUBLIC: ${log.IS_PUBLIC}`);

    // 3. 9번 신고 접수
    console.log('\n3. 9번의 신고 접수 중...');
    for (let i = 1; i <= 9; i++) {
      const { error: repErr } = await supabase.from('SPIN_LOG_REPORT').insert({
        LOG_ID: testLogId,
        REPORTER_ID: reporters[i], // Use a different valid user for each report
        REASON: '테스트 신고',
        DETAILS: `신고 상세 ${i}`,
      });
      if (repErr) throw new Error('신고 접수 실패 (9회): ' + repErr.message);
    }

    // 4. 상태 확인 (9번일 때는 공개 상태 유지해야 함)
    const { data: check1 } = await supabase.from('LISTENING_LOG').select('IS_PUBLIC').eq('LOG_ID', testLogId).single();
    console.log(`✅ 9회 신고 후 IS_PUBLIC: ${check1?.IS_PUBLIC} (기대값: true)`);
    if (!check1?.IS_PUBLIC) throw new Error('오류: 9회 신고 만에 비공개로 전환되었습니다!');

    // 5. 10번째 신고 접수
    console.log('\n4. 10번째 신고 접수 (트리거 발동 조건)...');
    const { error: repErr10 } = await supabase.from('SPIN_LOG_REPORT').insert({
      LOG_ID: testLogId,
      REPORTER_ID: reporters[0], // 0번째 유저가 10번째 신고... 잠깐, 0번째는 안 썼으니 reporters[0] 쓰면 됨
      REASON: '테스트 신고 10',
    });
    if (repErr10) throw new Error('신고 접수 실패 (10회): ' + repErr10.message);

    // 6. 상태 확인 (10번 달성 후 비공개로 바뀌었는지)
    const { data: check2 } = await supabase.from('LISTENING_LOG').select('IS_PUBLIC').eq('LOG_ID', testLogId).single();
    console.log(`✅ 10회 신고 후 IS_PUBLIC: ${check2?.IS_PUBLIC} (기대값: false)`);
    
    if (check2?.IS_PUBLIC === false) {
      console.log('\n🎉 테스트 성공: 10회 신고 시 자동으로 비공개 처리되었습니다!');
    } else {
      console.log('\n❌ 테스트 실패: 10회 신고 후에도 비공개 처리되지 않았습니다.');
    }

  } catch (err: any) {
    console.error('테스트 중 오류 발생:', err.message);
  } finally {
    // 7. 데이터 정리
    console.log('\n--- 데이터 정리 ---');
    if (testLogId) {
      await supabase.from('SPIN_LOG_REPORT').delete().eq('LOG_ID', testLogId); // 신고 기록 삭제
      await supabase.from('LISTENING_LOG').delete().eq('LOG_ID', testLogId);
      console.log('✅ 임시 다이어리 삭제 완료');
    }
    if (testAlbumId) {
      await supabase.from('ALBUM_MASTER').delete().eq('ALBUM_ID', testAlbumId);
      console.log('✅ 임시 앨범 삭제 완료');
    }
    console.log('테스트 종료.');
  }
}

runTest();
