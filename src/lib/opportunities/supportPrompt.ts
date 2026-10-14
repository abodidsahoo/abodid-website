export const OPPORTUNITY_SUPPORT_MILESTONE = 10;

export const getOpportunitySupportPromptStorageKey = (username: string) =>
    `opportunity-support-prompt:v1:${username.trim().toLowerCase()}`;

interface ShouldShowOpportunitySupportPromptOptions {
    opportunityCount: number;
    isOwner: boolean;
    isLoading: boolean;
    hasBeenDismissed: boolean;
}

export const shouldShowOpportunitySupportPrompt = ({
    opportunityCount,
    isOwner,
    isLoading,
    hasBeenDismissed,
}: ShouldShowOpportunitySupportPromptOptions) =>
    isOwner
    && !isLoading
    && !hasBeenDismissed
    && opportunityCount >= OPPORTUNITY_SUPPORT_MILESTONE;
