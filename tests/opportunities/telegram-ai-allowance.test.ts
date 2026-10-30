import { beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  admit: vi.fn(),
  transcribe: vi.fn(),
  release: vi.fn(),
}));
vi.mock("../../src/lib/opportunities/rateLimit", () => ({
  consumeOpportunityAiLimit: h.admit,
}));
vi.mock("../../src/lib/audio/transcribeAudio", async (original) => ({
  ...(await original<typeof import("../../src/lib/audio/transcribeAudio")>()),
  transcribeAudio: h.transcribe,
}));
import { processOpportunityCaptureJobs } from "../../src/lib/opportunities/captureJobs";
const job = {
  id: "job-1",
  user_id: "owner",
  input_kind: "attachments",
  payload: {
    attachments: [
      {
        path: "owner/job/voice.ogg",
        name: "voice.ogg",
        type: "audio/ogg",
        size: 4,
      },
    ],
  },
  attempt_count: 3,
  max_attempts: 3,
  messaging_event_id: null,
};
const service = () => {
  const chain: any = {
    select: () => chain,
    not: () => chain,
    is: () => chain,
    lte: () => chain,
    order: () => chain,
    eq: () => chain,
    update: vi.fn(() => chain),
    limit: async () => ({ data: [], error: null }),
    then: (resolve: any) => resolve({ data: [], error: null }),
  };
  return {
    from: () => chain,
    rpc: async () => ({ data: [job], error: null }),
    storage: {
      from: () => ({
        download: async () => ({
          data: new Blob(["test"], { type: "audio/ogg" }),
          error: null,
        }),
      }),
    },
  };
};
beforeEach(() => {
  vi.clearAllMocks();
  h.admit.mockResolvedValue({
    allowed: false,
    status: 429,
    code: "AI_MONTHLY_LIMIT_REACHED",
    message: "Monthly allowance exhausted",
  });
});
describe("Telegram voice cost admission", () => {
  it("does not transcribe an exhausted account", async () => {
    const result = await processOpportunityCaptureJobs({
      serviceClient: service() as any,
    });
    expect(result.failed).toBe(1);
    expect(h.admit).toHaveBeenCalledWith(expect.anything(), "owner");
    expect(h.transcribe).not.toHaveBeenCalled();
  });
  it("releases concurrency capacity if paid transcription fails", async () => {
    h.admit.mockResolvedValue({ allowed: true, release: h.release });
    h.transcribe.mockRejectedValue(new Error("Provider unavailable"));
    await processOpportunityCaptureJobs({ serviceClient: service() as any });
    expect(h.transcribe).toHaveBeenCalledOnce();
    expect(h.release).toHaveBeenCalledOnce();
  });
});
