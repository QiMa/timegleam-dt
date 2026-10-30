/**
 * Test-only client roster of the assembled viewer page.
 *
 * A served viewer page is the owner's own Web shell with the owner's client plugins; this roster is the
 * subset the viewer page specs need: the wire plugin, the Gateway, remote access, the Session/Workspace controllers,
 * the menu service, presentation plugins, and the Liveshare `./client` face, which mounts the viewer surfaces when the
 * carrier names a share. Every row is the package's own `/client` face registered as a module-table
 * factory. It must be imported only after {@link prepareViewerRemoteFaces} answered the generated
 * `/remote` faces these plugins import.
 *
 * @module @hy/dsh-experimental-liveshare/tests/viewer-page-roster
 */

import * as apiGateway from '@hy/dsh-api-gateway/client'
import * as apiRemoteAccess from '@hy/dsh-api-remote-access/client'
import * as apiRemotes from '@hy/dsh-api-remotes/client'
import * as apiSessionController from '@hy/dsh-api-session-controller/client'
import * as apiWorkspaceController from '@hy/dsh-api-workspace-controller/client'
import * as clientConnection from '@hy/dsh-client-connection/client'
import * as clientFileUpload from '@hy/dsh-client-file-upload/client'
import * as clientLocale from '@hy/dsh-client-locale/client'
import * as clientModules from '@hy/dsh-client-modules/client'
import * as clientResources from '@hy/dsh-client-resources/client'
import * as clientShortcuts from '@hy/dsh-client-shortcuts/client'
import * as uiAttachment from '@hy/dsh-client-ui-attachment/client'
import * as uiChat from '@hy/dsh-client-ui-chat/client'
import * as uiContextMenu from '@hy/dsh-client-ui-context-menu/client'
import * as uiConversation from '@hy/dsh-client-ui-conversation/client'
import * as uiDeliverables from '@hy/dsh-client-ui-deliverables/client'
import * as uiFileDrag from '@hy/dsh-client-ui-file-drag/client'
import * as uiLayout from '@hy/dsh-client-ui-layout/client'
import * as uiRenderer from '@hy/dsh-client-ui-renderer/client'
import * as uiSession from '@hy/dsh-client-ui-session/client'
import * as uiSettings from '@hy/dsh-client-ui-settings/client'
import * as uiSidebar from '@hy/dsh-client-ui-sidebar/client'
import * as uiSidebarRight from '@hy/dsh-client-ui-sidebar-right/client'
import * as uiTheme from '@hy/dsh-client-ui-theme/client'
import * as uiTool from '@hy/dsh-client-ui-tool/client'
import * as uiTrajectory from '@hy/dsh-client-ui-trajectory/client'
import * as uiWorkspace from '@hy/dsh-client-ui-workspace/client'
import * as typertRegistry from '@hy/dsh-typert-registry/client'
import * as liveshare from '../src/client/index.ts'

/** One module-table row: the entry id the Loader creates, and that plugin's client exports. */
export interface ViewerPageRosterRow {
  readonly id: string
  readonly exports: Readonly<Record<string, unknown>>
}

/** Entry id of the module-system bootstrap whose exports the facade hands to the module system. */
export const VIEWER_PAGE_BOOTSTRAP_ID = '@hy/dsh-client-modules'

/** The viewer page roster; Cordis composes these entries by service injection, so order is irrelevant. */
export const VIEWER_PAGE_ROSTER: readonly ViewerPageRosterRow[] = [
  { id: '@hy/dsh-typert-registry', exports: typertRegistry },
  { id: '@hy/dsh-experimental-liveshare', exports: liveshare },
  { id: VIEWER_PAGE_BOOTSTRAP_ID, exports: clientModules },
  { id: '@hy/dsh-client-connection', exports: clientConnection },
  { id: '@hy/dsh-api-gateway', exports: apiGateway },
  { id: '@hy/dsh-api-remote-access', exports: apiRemoteAccess },
  { id: '@hy/dsh-api-remotes', exports: apiRemotes },
  { id: '@hy/dsh-api-session-controller', exports: apiSessionController },
  { id: '@hy/dsh-api-workspace-controller', exports: apiWorkspaceController },
  { id: '@hy/dsh-client-file-upload', exports: clientFileUpload },
  { id: '@hy/dsh-client-locale', exports: clientLocale },
  { id: '@hy/dsh-client-resources', exports: clientResources },
  { id: '@hy/dsh-client-shortcuts', exports: clientShortcuts },
  { id: '@hy/dsh-client-ui-renderer', exports: uiRenderer },
  { id: '@hy/dsh-client-ui-theme', exports: uiTheme },
  { id: '@hy/dsh-client-ui-settings', exports: uiSettings },
  { id: '@hy/dsh-client-ui-layout', exports: uiLayout },
  { id: '@hy/dsh-client-ui-session', exports: uiSession },
  { id: '@hy/dsh-client-ui-sidebar', exports: uiSidebar },
  { id: '@hy/dsh-client-ui-conversation', exports: uiConversation },
  { id: '@hy/dsh-client-ui-chat', exports: uiChat },
  { id: '@hy/dsh-client-ui-context-menu', exports: uiContextMenu },
  { id: '@hy/dsh-client-ui-tool', exports: uiTool },
  { id: '@hy/dsh-client-ui-attachment', exports: uiAttachment },
  { id: '@hy/dsh-client-ui-file-drag', exports: uiFileDrag },
  { id: '@hy/dsh-client-ui-sidebar-right', exports: uiSidebarRight },
  { id: '@hy/dsh-client-ui-trajectory', exports: uiTrajectory },
  { id: '@hy/dsh-client-ui-deliverables', exports: uiDeliverables },
  { id: '@hy/dsh-client-ui-workspace', exports: uiWorkspace },
]
