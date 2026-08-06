import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@vinyla/ui';
import { useLocale } from '@vinyla/i18n';
import { CommunityPostWithMeta } from '@vinyla/core-api';
import { CoverImage } from '../CoverImage';
import { buildShowcaseItems } from '../../utils/showcaseCarouselItems';

// 자랑게시판 글 하나를 인스타그램 피드 포스트처럼 보여주는 카드 —
// 소셜 탭 피드(SocialScreen)와 커뮤니티 자랑 목록(CommunityScreen)이 같은
// 콘텐츠를 다른 맥락에서 보여주므로 웹의 ShowcasePostCard와 동일한 구성으로
// 시각적 일관성을 맞춘다. 상세/프로필 이동은 이 컴포넌트가 직접 처리한다.

interface ShowcasePostCardProps {
  post: CommunityPostWithMeta;
}

const relativeTime = (iso: string, t: (key: any, params?: any) => string): string => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return t('feed.justNow');
  if (m < 60) return t('feed.minutesAgo', { m });
  const h = Math.floor(m / 60);
  if (h < 24) return t('feed.hoursAgo', { h });
  return t('feed.daysAgo', { d: Math.floor(h / 24) });
};

export const ShowcasePostCard: React.FC<ShowcasePostCardProps> = ({ post }) => {
  const { themeColors } = useTheme();
  const { t } = useLocale();
  const navigation = useNavigation<NavigationProp<any>>();
  const styles = getStyles(themeColors);

  const authorName = post.AUTHOR_NAME || t('feed.anonymous');
  // 사진/영상 + 첨부 앨범(오노추의 노래 포함)을 합친 목록의 첫 항목만
  // 썸네일로 보여준다 — 상세페이지의 캐러셀과 순서가 같아야 "첫 화면"이
  // 일관되게 느껴진다(앨범이 있으면 앨범 먼저, 없으면 사진/영상).
  const firstItem = buildShowcaseItems(post.albums || [], post.MEDIA_ITEMS || [])[0];

  const openProfile = () => navigation.navigate('UserProfile', { userId: post.AUTHOR_ID, name: post.AUTHOR_NAME });
  const openPost = () => navigation.navigate('CommunityPost', { postId: post.POST_ID });

  return (
    <TouchableOpacity style={[styles.card, { borderColor: themeColors.border }]} onPress={openPost} activeOpacity={0.85}>
      <View style={styles.header}>
        <TouchableOpacity onPress={openProfile}>
          {post.AUTHOR_IMAGE ? (
            <Image source={{ uri: post.AUTHOR_IMAGE }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: 'rgba(212,175,55,0.15)', alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ color: themeColors.accent, fontWeight: '700' }}>{authorName.slice(0, 1).toUpperCase()}</Text>
            </View>
          )}
        </TouchableOpacity>
        <View style={{ marginLeft: 10, flex: 1 }}>
          <TouchableOpacity onPress={openProfile}>
            <Text style={{ color: themeColors.accent, fontWeight: '700', fontSize: 13 }}>{authorName}</Text>
          </TouchableOpacity>
          <Text style={{ color: themeColors.textSecondary, fontSize: 11, marginTop: 1 }}>
            {t(`communityBoard.categories.${post.CATEGORY}` as any)} · {relativeTime(post.CREATED_AT, t)}
          </Text>
        </View>
      </View>

      {!firstItem ? (
        <View style={[styles.media, styles.mediaFallback]}>
          <Feather name="camera" size={28} color={themeColors.textSecondary} />
        </View>
      ) : firstItem.kind === 'video' ? (
        <View style={[styles.media, styles.mediaFallback]}>
          <Feather name="film" size={28} color={themeColors.textSecondary} />
        </View>
      ) : (
        <CoverImage
          uri={firstItem.kind === 'album' ? firstItem.imageUrl : firstItem.url}
          fallback={require('../../../assets/logo_real_transparent.png')}
          style={styles.media}
          resizeMode="cover"
        />
      )}

      <View style={{ padding: 14 }}>
        <Text style={{ color: themeColors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 6 }} numberOfLines={1}>{post.TITLE}</Text>
        <Text style={{ color: themeColors.textSecondary, fontSize: 13, lineHeight: 18 }} numberOfLines={2}>{post.CONTENT}</Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.stat}>
          <Feather name="heart" size={14} color={themeColors.textSecondary} />
          <Text style={{ color: themeColors.textSecondary, fontSize: 12 }}>{t('communityBoard.resonanceCount', { count: post.LIKE_COUNT })}</Text>
        </View>
        <View style={styles.stat}>
          <Feather name="message-circle" size={14} color={themeColors.textSecondary} />
          <Text style={{ color: themeColors.textSecondary, fontSize: 12 }}>{t('communityBoard.commentCount', { count: post.COMMENT_COUNT })}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const getStyles = (themeColors: any) => StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 6,
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  avatar: { width: 34, height: 34, borderRadius: 17 },
  media: { width: '100%', aspectRatio: 4 / 3 },
  mediaFallback: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
