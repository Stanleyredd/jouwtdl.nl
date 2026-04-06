"use client";

import { useState } from "react";

import { useLanguage } from "@/hooks/use-language";
import { getWeekRange, toDateKey } from "@/lib/date";
import { translateLifeAreaName } from "@/lib/i18n";
import type {
  DailyTaskInput,
  GoalStatus,
  MonthlyGoal,
  MonthlyGoalInput,
  TaskPriority,
  WeeklyGoal,
  WeeklyGoalInput,
} from "@/types";

function FormShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="app-surface app-panel">
      <p className="text-sm font-semibold text-[color:var(--foreground)]">{title}</p>
      {description ? (
        <p className="mt-1 text-sm text-[color:var(--muted)]">{description}</p>
      ) : null}
      <div className="mt-5 grid gap-4">{children}</div>
    </section>
  );
}

function FieldLabel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-[color:var(--foreground)]">{label}</span>
      {children}
    </label>
  );
}

const inputClassName = "app-input";
const OTHER_OPTION_VALUE = "";

export function MonthlyGoalForm({
  initialValue,
  lifeAreas,
  onSubmit,
  onCancel,
}: {
  initialValue?: MonthlyGoal;
  lifeAreas: string[];
  onSubmit: (value: MonthlyGoalInput) => void;
  onCancel?: () => void;
}) {
  const { t, language } = useLanguage();
  const [title, setTitle] = useState(initialValue?.title ?? "");
  const [description, setDescription] = useState(initialValue?.description ?? "");
  const [month, setMonth] = useState(initialValue?.month ?? new Date().getMonth() + 1);
  const [year, setYear] = useState(initialValue?.year ?? new Date().getFullYear());
  const [lifeArea, setLifeArea] = useState(initialValue?.lifeArea ?? lifeAreas[0] ?? "trading");
  const [status, setStatus] = useState<GoalStatus>(initialValue?.status ?? "not_started");
  const [dueDate, setDueDate] = useState(initialValue?.dueDate ?? "");

  return (
    <FormShell
      title={initialValue ? t("form.monthlyGoal.edit") : t("form.monthlyGoal.new")}
      description={t("form.keepShort")}
    >
      <FieldLabel label={t("form.title")}>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t("form.placeholder.monthlyTitle")}
          className={inputClassName}
        />
      </FieldLabel>
      <FieldLabel label={t("form.description")}>
        <textarea
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={t("form.placeholder.optionalContext")}
          className={inputClassName}
        />
      </FieldLabel>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FieldLabel label={t("form.month")}>
          <input
            type="number"
            min={1}
            max={12}
            value={month}
            onChange={(event) => setMonth(Number(event.target.value))}
            className={inputClassName}
          />
        </FieldLabel>
        <FieldLabel label={t("form.year")}>
          <input
            type="number"
            min={2024}
            max={2100}
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            className={inputClassName}
          />
        </FieldLabel>
        <FieldLabel label={t("form.area")}>
          <select
            value={lifeArea}
            onChange={(event) => setLifeArea(event.target.value)}
            className={inputClassName}
          >
            {lifeAreas.map((item) => (
              <option key={item} value={item}>
                {translateLifeAreaName(item, language)}
              </option>
            ))}
          </select>
        </FieldLabel>
        <FieldLabel label={t("form.status")}>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as GoalStatus)}
            className={inputClassName}
          >
            <option value="not_started">{t("form.notStarted")}</option>
            <option value="in_progress">{t("form.inProgress")}</option>
            <option value="completed">{t("form.completed")}</option>
            <option value="paused">{t("form.paused")}</option>
          </select>
        </FieldLabel>
      </div>
      <FieldLabel label={t("form.dueDate")}>
        <input
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
          className={inputClassName}
        />
      </FieldLabel>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() =>
            onSubmit({
              title,
              description,
              month,
              year,
              lifeArea,
              status,
              dueDate,
            })
          }
          className="app-button-primary text-sm"
        >
          {initialValue ? t("common.save") : t("form.addGoal")}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} className="app-button-secondary text-sm">
            {t("common.cancel")}
          </button>
        ) : null}
      </div>
    </FormShell>
  );
}

export function WeeklyGoalForm({
  initialValue,
  monthlyGoals,
  lifeAreas,
  onSubmit,
  onCancel,
}: {
  initialValue?: WeeklyGoal;
  monthlyGoals: MonthlyGoal[];
  lifeAreas: string[];
  onSubmit: (value: WeeklyGoalInput) => void;
  onCancel?: () => void;
}) {
  const { t, language } = useLanguage();
  const currentWeek = getWeekRange(new Date());
  const [monthlyGoalId, setMonthlyGoalId] = useState(
    initialValue ? (initialValue.monthlyGoalId ?? OTHER_OPTION_VALUE) : (monthlyGoals[0]?.id ?? OTHER_OPTION_VALUE),
  );
  const [title, setTitle] = useState(initialValue?.title ?? "");
  const [description, setDescription] = useState(initialValue?.description ?? "");
  const [startDate, setStartDate] = useState(initialValue?.startDate ?? currentWeek.startKey);
  const [endDate, setEndDate] = useState(initialValue?.endDate ?? currentWeek.endKey);
  const [lifeArea, setLifeArea] = useState(initialValue?.lifeArea ?? lifeAreas[0] ?? "trading");
  const [status, setStatus] = useState<GoalStatus>(initialValue?.status ?? "not_started");

  return (
    <FormShell
      title={initialValue ? t("form.weeklyGoal.edit") : t("form.weeklyGoal.new")}
      description={t("form.keepWeekRealistic")}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldLabel label={t("form.monthlyGoal")}>
          <select
            value={monthlyGoalId}
            onChange={(event) => setMonthlyGoalId(event.target.value)}
            className={inputClassName}
          >
            <option value={OTHER_OPTION_VALUE}>{t("common.other")}</option>
            {monthlyGoals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.title}
              </option>
            ))}
          </select>
        </FieldLabel>
        <FieldLabel label={t("form.area")}>
          <select
            value={lifeArea}
            onChange={(event) => setLifeArea(event.target.value)}
            className={inputClassName}
          >
            {lifeAreas.map((item) => (
              <option key={item} value={item}>
                {translateLifeAreaName(item, language)}
              </option>
            ))}
          </select>
        </FieldLabel>
      </div>
      <FieldLabel label={t("form.title")}>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t("form.placeholder.weeklyTitle")}
          className={inputClassName}
        />
      </FieldLabel>
      <FieldLabel label={t("form.description")}>
        <textarea
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={t("form.placeholder.optionalContext")}
          className={inputClassName}
        />
      </FieldLabel>
      <div className="grid gap-4 sm:grid-cols-3">
        <FieldLabel label={t("form.start")}>
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className={inputClassName}
          />
        </FieldLabel>
        <FieldLabel label={t("form.end")}>
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className={inputClassName}
          />
        </FieldLabel>
        <FieldLabel label={t("form.status")}>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as GoalStatus)}
            className={inputClassName}
          >
            <option value="not_started">{t("form.notStarted")}</option>
            <option value="in_progress">{t("form.inProgress")}</option>
            <option value="completed">{t("form.completed")}</option>
            <option value="paused">{t("form.paused")}</option>
          </select>
        </FieldLabel>
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() =>
            onSubmit({
              monthlyGoalId: monthlyGoalId || null,
              title,
              description,
              startDate,
              endDate,
              lifeArea,
              status,
            })
          }
          className="app-button-primary text-sm"
        >
          {initialValue ? t("common.save") : t("form.addGoal")}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} className="app-button-secondary text-sm">
            {t("common.cancel")}
          </button>
        ) : null}
      </div>
    </FormShell>
  );
}

export function DailyTaskForm({
  initialValue,
  weeklyGoals,
  lifeAreas,
  defaultDate,
  onSubmit,
  onCancel,
}: {
  initialValue?: DailyTaskInput;
  weeklyGoals: WeeklyGoal[];
  lifeAreas: string[];
  defaultDate?: string;
  onSubmit: (value: DailyTaskInput) => void;
  onCancel?: () => void;
}) {
  const { t, language } = useLanguage();
  const [weeklyGoalId, setWeeklyGoalId] = useState(
    initialValue ? (initialValue.weeklyGoalId ?? OTHER_OPTION_VALUE) : (weeklyGoals[0]?.id ?? OTHER_OPTION_VALUE),
  );
  const [title, setTitle] = useState(initialValue?.title ?? "");
  const [note, setNote] = useState(initialValue?.note ?? "");
  const [date, setDate] = useState(initialValue?.date ?? defaultDate ?? toDateKey(new Date()));
  const [priority, setPriority] = useState<TaskPriority>(initialValue?.priority ?? "medium");
  const [lifeArea, setLifeArea] = useState(initialValue?.lifeArea ?? lifeAreas[0] ?? "trading");

  return (
    <FormShell
      title={initialValue ? t("form.dailyTask.edit") : t("form.dailyTask.new")}
      description={t("form.makeNextStepObvious")}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldLabel label={t("form.weeklyGoal")}>
          <select
            value={weeklyGoalId}
            onChange={(event) => setWeeklyGoalId(event.target.value)}
            className={inputClassName}
          >
            <option value={OTHER_OPTION_VALUE}>{t("common.other")}</option>
            {weeklyGoals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.title}
              </option>
            ))}
          </select>
        </FieldLabel>
        <FieldLabel label={t("form.area")}>
          <select
            value={lifeArea}
            onChange={(event) => setLifeArea(event.target.value)}
            className={inputClassName}
          >
            {lifeAreas.map((item) => (
              <option key={item} value={item}>
                {translateLifeAreaName(item, language)}
              </option>
            ))}
          </select>
        </FieldLabel>
      </div>
      <FieldLabel label={t("form.task")}>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t("form.placeholder.taskTitle")}
          className={inputClassName}
        />
      </FieldLabel>
      <FieldLabel label={t("form.note")}>
        <textarea
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t("form.placeholder.optionalDetail")}
          className={inputClassName}
        />
      </FieldLabel>
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldLabel label={t("form.date")}>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className={inputClassName}
          />
        </FieldLabel>
        <FieldLabel label={t("form.priority")}>
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value as TaskPriority)}
            className={inputClassName}
          >
            <option value="high">{t("form.priorityHigh")}</option>
            <option value="medium">{t("form.priorityMedium")}</option>
            <option value="low">{t("form.priorityLow")}</option>
          </select>
        </FieldLabel>
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() =>
            onSubmit({
              weeklyGoalId: weeklyGoalId || null,
              title,
              note,
              date,
              priority,
              lifeArea,
            })
          }
          className="app-button-primary text-sm"
        >
          {initialValue ? t("common.save") : t("form.addTask")}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} className="app-button-secondary text-sm">
            {t("common.cancel")}
          </button>
        ) : null}
      </div>
    </FormShell>
  );
}

export function LifeAreaManager({
  lifeAreas,
  onAdd,
}: {
  lifeAreas: string[];
  onAdd: (value: string) => void;
}) {
  const { t, language } = useLanguage();
  const [draft, setDraft] = useState("");

  return (
    <FormShell title={t("form.lifeAreas")} description={t("form.keepShort")}>
      <div className="flex flex-wrap gap-2">
        {lifeAreas.map((lifeArea) => (
          <span key={lifeArea} className="app-chip-muted text-sm">
            {translateLifeAreaName(lifeArea, language)}
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t("form.areaPlaceholder")}
          className={`${inputClassName} flex-1`}
        />
        <button
          type="button"
          onClick={() => {
            onAdd(draft);
            setDraft("");
          }}
          className="app-button-primary text-sm"
        >
          {t("form.addArea")}
        </button>
      </div>
    </FormShell>
  );
}
