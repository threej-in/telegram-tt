import type { FC } from '../../lib/teact/teact';
import React, { memo, useEffect, useMemo, useRef } from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import type { ApiChatFolder, ApiChatlistExportedInvite } from '../../api/types';
import type { MenuItemContextAction } from './ListItem';
import { ALL_FOLDER_ID } from '../../config';
import { selectCanShareFolder, selectTabState } from '../../global/selectors';
import { MEMO_EMPTY_ARRAY } from '../../util/memo';
import { renderTextWithEntities } from '../common/helpers/renderTextWithEntities';

import useLang from '../../hooks/useLang';
import { useFolderManagerForUnreadCounters } from '../../hooks/useFolderManager';
import { selectCurrentLimit } from '../../global/selectors/limits';
import useLastCallback from '../../hooks/useLastCallback';
import { IS_TOUCH_ENV } from '../../util/windowEnvironment';
import TabList, { TabWithProperties } from './TabList';
import captureEscKeyListener from '../../util/captureEscKeyListener';
import useHistoryBack from '../../hooks/useHistoryBack';
import buildClassName from '../../util/buildClassName';
import { captureEvents, SwipeDirection } from '../../util/captureEvents';

import "./ChatFoldersTab.scss";
import useAppLayout from '../../hooks/useAppLayout';
import Button from './Button';
import { LeftColumnContent, SettingsScreens } from '../../types';
import Icon from '../common/icons/Icon';

export const TAB_VIEW = {
  TOP: 0,
  LEFT: 1,
};

export type OwnProps = {
  shouldHideFolderTabs?: boolean;
  shouldSkipTransition?: boolean;
  isForumPanelOpen?: boolean;
  onFolderTabsChange: (tabs: TabWithProperties[]) => void;
  transitionRef?: React.RefObject<HTMLDivElement>;
  initiator: typeof TAB_VIEW.LEFT | typeof TAB_VIEW.TOP;
  dropdownRef: { current: { toggle: () => void } };
  setContent: (content: LeftColumnContent) => void;
};

type StateProps = {
  chatFoldersById: Record<number, ApiChatFolder>;
  folderInvitesById: Record<number, ApiChatlistExportedInvite[]>;
  orderedFolderIds?: number[];
  activeChatFolder: number;
  currentUserId?: string;
  maxFolders: number;
  maxChatLists: number;
  maxFolderInvites: number;
  isChatFoldersTabHorizontal: boolean;
};

const FIRST_FOLDER_INDEX = 0;
const SAVED_MESSAGES_HOTKEY = '0';

const ChatFoldersTab: FC<OwnProps & StateProps> = ({
  chatFoldersById,
  orderedFolderIds,
  activeChatFolder,
  currentUserId,
  maxFolders,
  maxChatLists,
  folderInvitesById,
  maxFolderInvites,
  shouldHideFolderTabs,
  shouldSkipTransition,
  isChatFoldersTabHorizontal,
  isForumPanelOpen,
  onFolderTabsChange,
  transitionRef = useRef<HTMLDivElement>(null),
  initiator,
  dropdownRef,
  setContent,
}) => {
  const {
    loadChatFolders,
    setActiveChatFolder,
    openChat,
    openShareChatFolderModal,
    openDeleteChatFolderModal,
    openEditChatFolder,
    openLimitReachedModal,
    requestNextSettingsScreen,
  } = getActions();

  const lang = useLang();
  const { isMobile } = useAppLayout();

  useEffect(() => {
    loadChatFolders();
  }, [loadChatFolders]);

  const allChatsFolder: ApiChatFolder = useMemo(() => {
    return {
      id: ALL_FOLDER_ID,
      title: { text: orderedFolderIds?.[0] === ALL_FOLDER_ID ? lang('FilterAllChatsShort') : lang('FilterAllChats') },
      includedChatIds: MEMO_EMPTY_ARRAY,
      excludedChatIds: MEMO_EMPTY_ARRAY,
    } satisfies ApiChatFolder;
  }, [orderedFolderIds, lang]);

  const displayedFolders = useMemo(() => {
    return orderedFolderIds
      ? orderedFolderIds.map((id) => {
        if (id === ALL_FOLDER_ID) {
          return allChatsFolder;
        }

        return chatFoldersById[id] || {};
      }).filter(Boolean)
      : undefined;
  }, [chatFoldersById, allChatsFolder, orderedFolderIds]);

  const isInFirstFolder = FIRST_FOLDER_INDEX === activeChatFolder;

  const folderCountersById = useFolderManagerForUnreadCounters();

  const folderTabs = useMemo(() => {
    if (!displayedFolders) return [];

    return displayedFolders.map((folder, i) => {
      const { id, title, emoticon, contacts, nonContacts, bots, groups, channels } = folder;
      const isBlocked = id !== ALL_FOLDER_ID && i > maxFolders - 1;
      const canShareFolder = selectCanShareFolder(getGlobal(), id);
      const contextActions: MenuItemContextAction[] = [];

      if (canShareFolder) {
        contextActions.push({
          title: lang('FilterShare'),
          icon: 'link',
          handler: () => {
            const chatListCount = Object.values(chatFoldersById).reduce((acc, el) => acc + (el.isChatList ? 1 : 0), 0);
            if (chatListCount >= maxChatLists && !folder.isChatList) {
              openLimitReachedModal({
                limit: 'chatlistJoined',
              });
              return;
            }

            // Greater amount can be after premium downgrade
            if (folderInvitesById[id]?.length >= maxFolderInvites) {
              openLimitReachedModal({
                limit: 'chatlistInvites',
              });
              return;
            }

            openShareChatFolderModal({
              folderId: id,
            });
          },
        });
      }

      if (id !== ALL_FOLDER_ID) {
        contextActions.push({
          title: lang('FilterEdit'),
          icon: 'edit',
          handler: () => {
            openEditChatFolder({ folderId: id });
          },
        });

        contextActions.push({
          title: lang('FilterDelete'),
          icon: 'delete',
          destructive: true,
          handler: () => {
            openDeleteChatFolderModal({ folderId: id });
          },
        });
      }

      return {
        id,
        emoticon,
        title: renderTextWithEntities({
          text: title.text,
          entities: title.entities,
          noCustomEmojiPlayback: folder.noTitleAnimations,
        }),
        entities: title.entities,
        badgeCount: folderCountersById[id]?.chatsCount,
        isBadgeActive: Boolean(folderCountersById[id]?.notificationsCount),
        isBlocked,
        contextActions: contextActions?.length ? contextActions : undefined,
        chatCategory: {
          isAllChatsFolder: id === ALL_FOLDER_ID,
          contacts,
          nonContacts,
          bots,
          groups,
          channels,
        },
      } satisfies TabWithProperties;
    });
  }, [
    displayedFolders, maxFolders, folderCountersById, lang, chatFoldersById, maxChatLists, folderInvitesById,
    maxFolderInvites,
  ]);

  useEffect(() => {
    onFolderTabsChange(folderTabs || []);
  }, [folderTabs, onFolderTabsChange]);

  const handleSwitchTab = useLastCallback((index: number) => {
    setContent(LeftColumnContent.ChatList);
    setActiveChatFolder({ activeChatFolder: index }, { forceOnHeavyAnimation: true });
  });

  // Prevent `activeTab` pointing at non-existing folder after update
  useEffect(() => {
    if (!folderTabs?.length) {
      return;
    }

    if (activeChatFolder >= folderTabs.length) {
      setActiveChatFolder({ activeChatFolder: FIRST_FOLDER_INDEX });
    }
  }, [activeChatFolder, folderTabs, setActiveChatFolder]);

  useEffect(() => {
    if (!transitionRef.current || !IS_TOUCH_ENV) {
      return undefined;
    }

    return captureEvents(transitionRef.current, {
      onSwipe: (e, direction) => {
        if (!folderTabs?.length || !displayedFolders?.length) {
          return false;
        }

        if (direction === SwipeDirection.Left) {
          const nextFolder = Math.min(activeChatFolder + 1, folderTabs.length - 1);
          setActiveChatFolder({ activeChatFolder: nextFolder }, { forceOnHeavyAnimation: true });
          return true;
        } else if (direction === SwipeDirection.Right) {
          setActiveChatFolder({ activeChatFolder: Math.max(0, activeChatFolder - 1) }, { forceOnHeavyAnimation: true });
          return true;
        }

        return false;
      },
    });
  }, [activeChatFolder, folderTabs, displayedFolders, setActiveChatFolder, transitionRef]);

  const isNotInFirstFolderRef = useRef();
  isNotInFirstFolderRef.current = !isInFirstFolder;

  useEffect(() => (isNotInFirstFolderRef.current ? captureEscKeyListener(() => {
    if (isNotInFirstFolderRef.current) {
      setActiveChatFolder({ activeChatFolder: FIRST_FOLDER_INDEX });
    }
  }) : undefined), [activeChatFolder, setActiveChatFolder]);

  useHistoryBack({
    isActive: !isInFirstFolder,
    onBack: () => setActiveChatFolder({ activeChatFolder: FIRST_FOLDER_INDEX }, { forceOnHeavyAnimation: true }),
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.code.startsWith('Digit') && folderTabs) {
        const [, digit] = e.code.match(/Digit(\d)/) || [];
        if (!digit) return;

        if (digit === SAVED_MESSAGES_HOTKEY) {
          openChat({ id: currentUserId, shouldReplaceHistory: true });
          return;
        }

        const folder = Number(digit) - 1;
        if (folder > folderTabs.length - 1) return;

        setActiveChatFolder({ activeChatFolder: folder }, { forceOnHeavyAnimation: true });
        e.preventDefault();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [currentUserId, folderTabs, openChat, setActiveChatFolder]);

  const shouldRender = useMemo(() => {
    if (folderTabs && folderTabs.length > 1) {
      switch (initiator) {
        case TAB_VIEW.TOP:
          if (isMobile) return true;
          else if (isChatFoldersTabHorizontal) return true;
          else return false;
        case TAB_VIEW.LEFT:
          if (isMobile) return false;
          else if (isChatFoldersTabHorizontal) return false;
          else return true;
        default:
          return false;
      }
    }
    return false;
  }, [folderTabs, initiator, isMobile, isChatFoldersTabHorizontal]);

  const isVertical = !isMobile && !isChatFoldersTabHorizontal;

  const handleSettingsClick = useLastCallback(() => {
    requestNextSettingsScreen({ screen: SettingsScreens.Folders });
  });

  return (
    shouldRender &&
    <div className={buildClassName(isVertical && 'VerticalTabList')}>
      {isVertical && (
        <Button
          color='translucent'
          id='verticalDropdownButton'
          onClick={() => {
            if (dropdownRef.current) {
              dropdownRef.current.toggle();
            }
          }}
        >
          <div className={buildClassName(
            'animated-menu-icon',
            shouldSkipTransition && 'no-animation',
          )}
          />
        </Button>
      )}
      <TabList
        contextRootElementSelector="#LeftColumn"
        tabs={folderTabs}
        activeTab={activeChatFolder}
        onSwitchTab={handleSwitchTab}
        className={buildClassName(
          'tabs-container',
          'chat-folders-tabs',
          shouldHideFolderTabs && 'ChatFolders--tabs-hidden',
          isForumPanelOpen && 'with-forum-panel',
        )}
        isChatFoldersTabHorizontal={isChatFoldersTabHorizontal}
      />
      {
        isVertical && (
          <Button
            color='translucent'
            onClick={handleSettingsClick}
          >
            <Icon name='settings' className='folder-settings' />
          </Button>
        )
      }
    </div>
  )
};
export default memo(withGlobal<OwnProps>(
  (global) => {
    const {
      chatFolders: {
        byId: chatFoldersById,
        orderedIds: orderedFolderIds,
        invites: folderInvitesById,
      },
      currentUserId,
      settings: {
        byKey: { isChatFoldersTabHorizontal },
      },
    } = global;

    const { activeChatFolder } = selectTabState(global);
    const maxFolders = selectCurrentLimit(global, 'dialogFilters');
    const maxChatLists = selectCurrentLimit(global, 'chatlistJoined');
    const maxFolderInvites = selectCurrentLimit(global, 'chatlistInvites');

    return {
      chatFoldersById,
      folderInvitesById,
      orderedFolderIds,
      activeChatFolder,
      currentUserId,
      maxFolders,
      maxChatLists,
      maxFolderInvites,
      isChatFoldersTabHorizontal
    };
  },
)(ChatFoldersTab));
