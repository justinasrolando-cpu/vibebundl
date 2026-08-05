"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ExperienceItem = {
  company: string;
  role: string;
  start: string;
  end: string;
  description: string;
};

type EducationItem = {
  school: string;
  degree: string;
  start: string;
  end: string;
};

type ResumeData = {
  name: string;
  email: string;
  phone: string;
  summary: string;
  experience: ExperienceItem[];
  education: EducationItem[];
  skills: string[];
};

type ResumeRow = {
  id: string;
  user_id: string;
  title: string;
  data: Partial<ResumeData> | null;
  updated_at: string;
  created_at: string;
};

const EMPTY_DATA: ResumeData = {
  name: "",
  email: "",
  phone: "",
  summary: "",
  experience: [],
  education: [],
  skills: [],
};

function emptyExperience(): ExperienceItem {
  return { company: "", role: "", start: "", end: "", description: "" };
}

function emptyEducation(): EducationItem {
  return { school: "", degree: "", start: "", end: "" };
}

export default function ResumeBuilderPage() {
  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState<string | null>(null);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const [title, setTitle] = useState("My Resume");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [summary, setSummary] = useState("");
  const [experience, setExperience] = useState<ExperienceItem[]>([]);
  const [education, setEducation] = useState<EducationItem[]>([]);
  const [skillsInput, setSkillsInput] = useState("");

  const skills = useMemo(
    () =>
      skillsInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    [skillsInput],
  );

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);

      if (user) {
        const { data, error } = await supabase
          .from("resumes")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (error) {
          setLoadError(`Could not load your resume: ${error.message}`);
        } else if (data) {
          const row = data as ResumeRow;
          // `data` is free-form jsonb — only merge it when it really is an object,
          // and drop any malformed list items so the editor cannot crash on them.
          const stored =
            row.data && typeof row.data === "object" && !Array.isArray(row.data) ? row.data : {};
          const d: ResumeData = { ...EMPTY_DATA, ...stored };
          setResumeId(row.id);
          setTitle(row.title || "My Resume");
          setName(d.name ?? "");
          setEmail(d.email ?? "");
          setPhone(d.phone ?? "");
          setSummary(d.summary ?? "");
          setExperience(
            Array.isArray(d.experience)
              ? d.experience
                  .filter((it): it is ExperienceItem => !!it && typeof it === "object")
                  .map((it) => ({ ...emptyExperience(), ...it }))
              : [],
          );
          setEducation(
            Array.isArray(d.education)
              ? d.education
                  .filter((it): it is EducationItem => !!it && typeof it === "object")
                  .map((it) => ({ ...emptyEducation(), ...it }))
              : [],
          );
          setSkillsInput(
            Array.isArray(d.skills) ? d.skills.filter((s) => typeof s === "string").join(", ") : "",
          );
        }
      }
      setLoading(false);
    })();
  }, [supabase]);

  // Nothing autosaves, so track edits made after the initial load and warn the
  // user that "Saved 10:04" no longer reflects what is on screen.
  // Declared before the hydration effect below so the first post-load commit is
  // not counted as an edit.
  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current) setDirty(true);
  }, [title, name, email, phone, summary, experience, education, skillsInput]);

  useEffect(() => {
    if (!loading) hydrated.current = true;
  }, [loading]);

  const handleSave = useCallback(async () => {
    if (!userId) {
      setSaveError("You need to be signed in to save your resume.");
      return;
    }
    setSaving(true);
    setSaveError(null);

    const dataPayload: ResumeData = {
      name,
      email,
      phone,
      summary,
      experience,
      education,
      skills,
    };

    if (resumeId) {
      const { error } = await supabase
        .from("resumes")
        .update({
          title: title || "My Resume",
          data: dataPayload,
          updated_at: new Date().toISOString(),
        })
        .eq("id", resumeId);
      if (error) {
        setSaveError(error.message);
      } else {
        setSavedAt(new Date().toLocaleTimeString());
        setDirty(false);
      }
    } else {
      const { data, error } = await supabase
        .from("resumes")
        .insert({
          user_id: userId,
          title: title || "My Resume",
          data: dataPayload,
        })
        .select("id")
        .single();
      if (error || !data) {
        setSaveError(error?.message ?? "Could not save your resume. Please try again.");
      } else {
        setResumeId((data as { id: string }).id);
        setSavedAt(new Date().toLocaleTimeString());
        setDirty(false);
      }
    }

    setSaving(false);
  }, [supabase, userId, resumeId, title, name, email, phone, summary, experience, education, skills]);

  const updateExperience = (index: number, patch: Partial<ExperienceItem>) => {
    setExperience((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const updateEducation = (index: number, patch: Partial<EducationItem>) => {
    setEducation((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  if (loading) {
    return (
      <div className="p-6 md:p-8">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="resume-page p-6 md:p-8">
      <style>{`
        @media print {
          html, body { background: #fff !important; }
          .no-print { display: none !important; }
          /* Keep the printed resume in normal flow — absolute positioning here
             makes multi-page resumes print only their first page. */
          .resume-page { padding: 0 !important; margin: 0 !important; }
          .print-area {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>

      <div className="no-print">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Resume Builder</h1>
            <p className="mt-1 text-sm text-muted">
              Fill in your details on the left, see a live preview on the right. Changes are stored only when
              you press Save. Export opens your browser&apos;s print dialog — choose &ldquo;Save as PDF&rdquo;.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {dirty ? (
              <span className="text-xs text-muted">Unsaved changes</span>
            ) : (
              savedAt && <span className="text-xs text-muted">Saved {savedAt}</span>
            )}
            <button onClick={handleSave} disabled={saving} className="btn btn-primary">
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => window.print()} className="btn btn-secondary">
              Export / Print PDF
            </button>
          </div>
        </div>

        {loadError && <p className="mt-3 text-sm text-danger">{loadError}</p>}
        {saveError && <p className="mt-3 text-sm text-danger">{saveError}</p>}

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Editor */}
          <div className="flex flex-col gap-4">
            <div className="card animate-fade-in p-4">
              <label className="text-xs font-medium text-muted">Resume title (internal, not shown on PDF)</label>
              <input
                className="input mt-1 w-full"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="My Resume"
              />

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-muted">Full name</label>
                  <input
                    className="input mt-1 w-full"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted">Email</label>
                  <input
                    className="input mt-1 w-full"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jane@email.com"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted">Phone</label>
                  <input
                    className="input mt-1 w-full"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 555 000 1234"
                  />
                </div>
              </div>

              <div className="mt-3">
                <label className="text-xs font-medium text-muted">Summary</label>
                <textarea
                  className="input mt-1 w-full resize-none"
                  rows={3}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Short professional summary…"
                />
              </div>

              <div className="mt-3">
                <label className="text-xs font-medium text-muted">Skills (comma-separated)</label>
                <input
                  className="input mt-1 w-full"
                  value={skillsInput}
                  onChange={(e) => setSkillsInput(e.target.value)}
                  placeholder="TypeScript, Figma, SQL, Leadership"
                />
              </div>
            </div>

            {/* Experience */}
            <div className="card animate-fade-in p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Experience</h2>
                <button
                  onClick={() => setExperience((prev) => [...prev, emptyExperience()])}
                  className="btn btn-secondary text-xs"
                >
                  + Add
                </button>
              </div>

              {experience.length === 0 && (
                <p className="mt-2 text-xs text-muted">No experience added yet.</p>
              )}

              <div className="mt-3 flex flex-col gap-3">
                {experience.map((item, i) => (
                  <div key={i} className="rounded-lg border border-border p-3">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <input
                        className="input"
                        placeholder="Company"
                        value={item.company}
                        onChange={(e) => updateExperience(i, { company: e.target.value })}
                      />
                      <input
                        className="input"
                        placeholder="Role"
                        value={item.role}
                        onChange={(e) => updateExperience(i, { role: e.target.value })}
                      />
                      <input
                        className="input"
                        placeholder="Start (e.g. Jan 2022)"
                        value={item.start}
                        onChange={(e) => updateExperience(i, { start: e.target.value })}
                      />
                      <input
                        className="input"
                        placeholder="End (e.g. Present)"
                        value={item.end}
                        onChange={(e) => updateExperience(i, { end: e.target.value })}
                      />
                    </div>
                    <textarea
                      className="input mt-2 w-full resize-none"
                      rows={2}
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateExperience(i, { description: e.target.value })}
                    />
                    <button
                      onClick={() => setExperience((prev) => prev.filter((_, idx) => idx !== i))}
                      className="mt-2 text-xs text-danger hover:opacity-80"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Education */}
            <div className="card animate-fade-in p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Education</h2>
                <button
                  onClick={() => setEducation((prev) => [...prev, emptyEducation()])}
                  className="btn btn-secondary text-xs"
                >
                  + Add
                </button>
              </div>

              {education.length === 0 && (
                <p className="mt-2 text-xs text-muted">No education added yet.</p>
              )}

              <div className="mt-3 flex flex-col gap-3">
                {education.map((item, i) => (
                  <div key={i} className="rounded-lg border border-border p-3">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <input
                        className="input"
                        placeholder="School"
                        value={item.school}
                        onChange={(e) => updateEducation(i, { school: e.target.value })}
                      />
                      <input
                        className="input"
                        placeholder="Degree"
                        value={item.degree}
                        onChange={(e) => updateEducation(i, { degree: e.target.value })}
                      />
                      <input
                        className="input"
                        placeholder="Start (e.g. 2018)"
                        value={item.start}
                        onChange={(e) => updateEducation(i, { start: e.target.value })}
                      />
                      <input
                        className="input"
                        placeholder="End (e.g. 2022)"
                        value={item.end}
                        onChange={(e) => updateEducation(i, { end: e.target.value })}
                      />
                    </div>
                    <button
                      onClick={() => setEducation((prev) => prev.filter((_, idx) => idx !== i))}
                      className="mt-2 text-xs text-danger hover:opacity-80"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Screen preview (paper look, scoped to this column only) */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <ResumePaper
              name={name}
              email={email}
              phone={phone}
              summary={summary}
              experience={experience}
              education={education}
              skills={skills}
              className="shadow-lg"
            />
          </div>
        </div>
      </div>

      {/* Print-only copy of the paper, hidden on screen */}
      <div className="print-area hidden print:block">
        <ResumePaper
          name={name}
          email={email}
          phone={phone}
          summary={summary}
          experience={experience}
          education={education}
          skills={skills}
        />
      </div>
    </div>
  );
}

function ResumePaper({
  name,
  email,
  phone,
  summary,
  experience,
  education,
  skills,
  className = "",
}: {
  name: string;
  email: string;
  phone: string;
  summary: string;
  experience: ExperienceItem[];
  education: EducationItem[];
  skills: string[];
  className?: string;
}) {
  const contactLine = [email, phone].filter(Boolean).join("  •  ");

  return (
    <div
      className={`animate-fade-in mx-auto w-full max-w-[720px] rounded-lg bg-white p-8 text-[#1a1a1a] sm:p-10 ${className}`}
    >
      <div className="border-b border-[#1a1a1a]/15 pb-4">
        <h2 className="text-2xl font-bold tracking-tight">{name || "Your Name"}</h2>
        {contactLine && <p className="mt-1 text-sm text-[#4a4a4a]">{contactLine}</p>}
      </div>

      {summary && (
        <div className="mt-4">
          <p className="text-sm leading-relaxed text-[#2a2a2a]">{summary}</p>
        </div>
      )}

      {experience.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[#1a1a1a]/70">
            Experience
          </h3>
          <div className="mt-2 flex flex-col gap-4">
            {experience.map((item, i) => (
              <div key={i}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="text-sm font-semibold">
                    {item.role || "Role"}
                    {item.company && <span className="font-normal text-[#4a4a4a]"> — {item.company}</span>}
                  </p>
                  {(item.start || item.end) && (
                    <p className="text-xs text-[#6a6a6a]">
                      {item.start}
                      {item.start && item.end ? " – " : ""}
                      {item.end}
                    </p>
                  )}
                </div>
                {item.description && (
                  <p className="mt-1 text-sm leading-relaxed text-[#2a2a2a]">{item.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {education.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[#1a1a1a]/70">
            Education
          </h3>
          <div className="mt-2 flex flex-col gap-3">
            {education.map((item, i) => (
              <div key={i} className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="text-sm font-semibold">
                  {item.degree || "Degree"}
                  {item.school && <span className="font-normal text-[#4a4a4a]"> — {item.school}</span>}
                </p>
                {(item.start || item.end) && (
                  <p className="text-xs text-[#6a6a6a]">
                    {item.start}
                    {item.start && item.end ? " – " : ""}
                    {item.end}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {skills.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[#1a1a1a]/70">Skills</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {skills.map((skill, i) => (
              <span
                key={i}
                className="rounded-full border border-[#1a1a1a]/15 px-2.5 py-0.5 text-xs text-[#2a2a2a]"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {!name && !summary && experience.length === 0 && education.length === 0 && skills.length === 0 && (
        <p className="mt-6 text-sm text-[#6a6a6a]">
          Fill in the form to see your resume take shape here.
        </p>
      )}
    </div>
  );
}
