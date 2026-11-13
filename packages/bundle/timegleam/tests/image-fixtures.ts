/** Shared fixtures for the TimeGleam image tool tests. */

import { Buffer } from 'node:buffer'

/** Proxy routes the tool calls. */
export const IMAGE_MODELS_URL = 'https://timegleam.com/v1/image-models'
export const IMAGE_URL = 'https://timegleam.com/v1/images/generations'

/** A 1x1 PNG used to prove signature sniffing and attachment storage. */
export const PNG_1X1 = new Uint8Array(Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
))

/** A 1x1 JPEG used to prove a second accepted format. */
export const JPEG_1X1 = new Uint8Array(Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
  'base64',
))
