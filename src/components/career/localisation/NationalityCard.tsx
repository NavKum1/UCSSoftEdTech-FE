"use client";

/** G12: the student's optional nationality, used only for workforce-localisation reporting. Shows the privacy notice. */

import React, { useMemo, useState } from "react";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Button, Card, ErrorBanner, Field, Loading, SuccessBanner, useCareerI18n, useCareerT, useLoad } from "@/components/career/ui";

interface NationalityView {
  countryCode: string | null;
  source: string | null;
  updatedAt: string | null;
  privacyNotice: string;
}

// ISO 3166-1 alpha-2 codes; names come from Intl.DisplayNames in the career locale
const CODES =
  "AD AE AF AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FR GA GB GD GE GH GM GN GQ GR GT GW GY HK HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KI KM KN KP KR KW KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MO MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NR NZ OM PA PE PG PH PK PL PS PT PW PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VN VU WS XK YE ZA ZM ZW".split(" ");

export default function NationalityCard() {
  const api = useApi();
  const { schoolId } = useCareerShell();
  const t = useCareerT("nationality");
  const { locale } = useCareerI18n();
  const { data, setData, error, loading, reload } = useLoad(() => api<NationalityView>("/api/career/localisation/nationality"), [api, schoolId]);
  const [value, setValue] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const options = useMemo(() => {
    let names: Intl.DisplayNames | null = null;
    try {
      names = new Intl.DisplayNames([locale, "en"], { type: "region" });
    } catch {
      names = null;
    }
    return CODES.map((c) => ({ code: c, name: names?.of(c) ?? c })).sort((a, b) => a.name.localeCompare(b.name, locale));
  }, [locale]);

  if (loading && !data) return <Loading />;
  if (!data) return <ErrorBanner error={error} onRetry={reload} />;
  const current = value ?? data.countryCode ?? "";

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await api<NationalityView>("/api/career/localisation/nationality", { method: "PUT", json: { countryCode: current || null } });
      setData(r);
      setValue(null);
      setMsg(r.countryCode ? t("saved") : t("cleared"));
    } catch (ex) {
      setErr((ex as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title={t("title")}>
      <h3 className="text-sm font-semibold">{t("privacyHeading")}</h3>
      <p className="mb-3 text-sm">{data.privacyNotice}</p>
      <ErrorBanner error={err} />
      <SuccessBanner message={msg} />
      <form onSubmit={save} className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <Field label={t("label")}>
            {(props) => (
              <select {...props} value={current} onChange={(e) => setValue(e.target.value)}>
                <option value="">{t("none")}</option>
                {options.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        <Button type="submit" busy={busy}>
          {t("save")}
        </Button>
      </form>
      {data.source && data.source !== "Student" && <p className="mt-2 text-xs text-muted-foreground">{t("source", { source: data.source })}</p>}
    </Card>
  );
}
