import { supabase } from "../supabaseClient";
import { isSupabaseConfigured } from "./utils";
import {
    DEFAULT_DESIGN_SETTINGS,
    normalizeDesignSettings,
    type SiteDesignSettings,
} from "../designTheme";

export interface SiteDesignSettingsRow {
    id?: string;
    settings_key: string;
    settings: SiteDesignSettings;
    created_at?: string;
    updated_at?: string;
    updated_by?: string | null;
}

export async function getSiteDesignSettings(): Promise<SiteDesignSettingsRow | null> {
    if (!isSupabaseConfigured() || !supabase) return null;

    const { data, error } = await supabase
        .from("site_design_settings")
        .select("*")
        .eq("settings_key", "global")
        .maybeSingle();

    if (error || !data) {
        return null;
    }

    return {
        ...data,
        settings: normalizeDesignSettings(data.settings),
    } as SiteDesignSettingsRow;
}

export async function getResolvedSiteDesignSettings(): Promise<SiteDesignSettings> {
    const row = await getSiteDesignSettings();
    if (!row) return DEFAULT_DESIGN_SETTINGS;
    return normalizeDesignSettings(row.settings);
}
