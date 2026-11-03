// Putting a file in front of a Messenger or Instagram sender.
//
// The same rules as WhatsApp, on purpose: the file is fetched here, only from a
// host the caller named, within the size the type allows, and its bytes must look
// like what it claims to be. Only then is it handed to Meta. What differs is the
// last step.
//
//   Messenger  the bytes are uploaded with the message (multipart), so nothing
//              depends on Meta being able to reach the source.
//   Instagram  accepts an attachment only by a public address, so the address
//              the file was fetched from is passed on. A file that exists only as
//              bytes (one converted on the processor) cannot be sent there and
//              is reported as such, which makes the caller answer with a link.
//
// The caption (the credit a Creative Commons licence asks for) travels as the
// text message that follows: neither channel carries a caption on a file.

import { GRAPH_BASE, GRAPH_VERSION } from "../meta.ts";
import {
  type DeliverableAsset,
  type DeliveryFailure,
  type DeliveryResult,
  deliveryRuleFor,
  fetchAssetBytes,
  safeFileName,
} from "../whatsappAssetDelivery.ts";
import { INSTAGRAM_GRAPH, sendMetaMessage, type MessagingFetch } from "./metaMessaging.ts";

export type MetaChannel = "messenger" | "instagram";

type AttachmentType = "image" | "video" | "audio" | "file";

const ATTACHMENT_TYPE: Record<string, AttachmentType> = { image: "image", video: "video", audio: "audio", document: "file" };

/** What the platform calls each kind of file. */
export function metaAttachmentType(kind: "image" | "video" | "audio" | "document"): AttachmentType {
  return ATTACHMENT_TYPE[kind];
}

export async function deliverMetaAsset(params: {
  channel: MetaChannel;
  /** The page id (Messenger) or Instagram account id the file is sent from. */
  fromAccountId: string;
  /** The PSID or IGSID it is sent to. */
  toUserId: string;
  token: string;
  asset: DeliverableAsset;
  fetchImpl?: typeof fetch;
}): Promise<DeliveryResult> {
  const started = Date.now();
  const ms = () => Date.now() - started;
  const doFetch = params.fetchImpl ?? fetch;
  const { asset } = params;
  const fail = (reason: DeliveryFailure): DeliveryResult => ({ outcome: "failed", reason, ms: ms() });

  try {
    const rule = deliveryRuleFor(asset.mimeType);
    if (!rule) return fail("asset_type_unsupported");

    let bytes = asset.bytes;
    if (!bytes) {
      if (!asset.url || !asset.allowedHosts?.length) return fail("asset_invalid");
      const fetched = await fetchAssetBytes({ url: asset.url, allowedHosts: asset.allowedHosts, maxBytes: rule.maxBytes, fetchImpl: doFetch });
      if (!fetched.ok) return fail(fetched.reason);
      bytes = fetched.bytes;
    }
    if (bytes.byteLength === 0) return fail("asset_invalid");
    if (bytes.byteLength > rule.maxBytes) return fail("asset_too_large");
    if (!rule.looksRight(bytes)) return fail("asset_content_mismatch");

    const type = metaAttachmentType(rule.kind);
    const filename = safeFileName(asset.fileName, asset.mimeType);
    let response: Response;

    if (params.channel === "messenger") {
      const form = new FormData();
      form.append("recipient", JSON.stringify({ id: params.toUserId }));
      form.append("messaging_type", "RESPONSE");
      form.append("message", JSON.stringify({ attachment: { type, payload: { is_reusable: false } } }));
      form.append("filedata", new Blob([bytes as BlobPart], { type: rule.uploadMime }), filename);
      response = await doFetch(`${GRAPH_BASE}/${params.fromAccountId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${params.token}` },
        body: form,
      });
    } else {
      // Instagram takes an address, never bytes. Only a file fetched as it is, from a host we named, has one.
      if (asset.bytes || !asset.url) return fail("meta_url_required");
      response = await doFetch(`${INSTAGRAM_GRAPH}/${GRAPH_VERSION}/me/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${params.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: { id: params.toUserId },
          messaging_type: "RESPONSE",
          message: { attachment: { type, payload: { url: asset.url } } },
        }),
      });
    }

    const answer = await response.json().catch(() => null) as { error?: unknown; message_id?: unknown } | null;
    if (!response.ok || !answer || answer.error) return fail("meta_send_rejected");

    // The credit line, after the file. Best effort: a missing caption does not undo a delivery.
    if (asset.caption) {
      await sendMetaMessage({
        channel: params.channel,
        fromAccountId: params.fromAccountId,
        toUserId: params.toUserId,
        text: asset.caption,
        token: params.token,
        fetchImpl: doFetch as unknown as MessagingFetch,
      }).catch(() => null);
    }

    return { outcome: `delivered_${rule.kind}`, kind: rule.kind, bytes: bytes.byteLength, uploadTries: 1, sendTries: 1, ms: ms() };
  } catch {
    return fail("meta_transport_error");
  }
}
