/** TimeGleam endpoints shared by the MCP row and the image proxy tool. */

/** Public origin that serves the workspace, the MCP endpoint, and the model proxy. */
export const TIMEGLEAM_ORIGIN = 'https://timegleam.com'

/** OpenAI-compatible model proxy root; chat and image routes hang off it. */
export const TIMEGLEAM_API_BASE = 'https://timegleam.com/v1'

/** Image models this connection may call. */
export const TIMEGLEAM_IMAGE_MODELS_URL = `${TIMEGLEAM_API_BASE}/image-models`

/** OpenAI-compatible synchronous image generation route. */
export const TIMEGLEAM_IMAGE_GENERATION_URL = `${TIMEGLEAM_API_BASE}/images/generations`

/** Credential reference the welcome flow writes the access key into. */
export const TIMEGLEAM_CREDENTIAL_REF = 'TIMEGLEAM_TOKEN'

/** Public MCP endpoint of the TimeGleam workspace. */
export const TIMEGLEAM_MCP_URL = `${TIMEGLEAM_ORIGIN}/mcp`
