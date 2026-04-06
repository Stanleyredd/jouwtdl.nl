import { differenceInCalendarDays, parseISO } from "date-fns";

import { getWeekRange, toDateKey } from "@/lib/date";
import { average } from "@/lib/utils";
import type {
  AppState,
  DailyTask,
  GoalStatus,
  MonthlyGoal,
  WeeklyGoal,
} from "@/types";

function inferGoalStatus(progress: number): GoalStatus {
  if (progress >= 100) {
    return "completed";
  }

  if (progress <= 0) {
    return "not_started";
  }

  return "in_progress";
}

export function recalculateAppState(state: AppState): AppState {
  const weeklyGoals = state.weeklyGoals.map((weeklyGoal) => {
    const linkedTasks = state.dailyTasks.filter(
      (task) => task.weeklyGoalId === weeklyGoal.id,
    );
    const progress =
      linkedTasks.length === 0
        ? weeklyGoal.progress
        : Math.round(
            (linkedTasks.filter((task) => task.completed).length /
              linkedTasks.length) *
              100,
          );

    return {
      ...weeklyGoal,
      progress,
      status:
        weeklyGoal.status === "paused"
          ? "paused"
          : inferGoalStatus(progress),
    };
  });

  const monthlyGoals = state.monthlyGoals.map((monthlyGoal) => {
    const linkedWeeklyGoals = weeklyGoals.filter(
      (weeklyGoal) => weeklyGoal.monthlyGoalId === monthlyGoal.id,
    );
    const progress =
      linkedWeeklyGoals.length === 0
        ? monthlyGoal.progress
        : Math.round(average(linkedWeeklyGoals.map((goal) => goal.progress)));

    return {
      ...monthlyGoal,
      progress,
      status:
        monthlyGoal.status === "paused"
          ? "paused"
          : inferGoalStatus(progress),
    };
  });

  return {
    ...state,
    weeklyGoals,
    monthlyGoals,
  };
}

export function getTasksForDate(tasks: DailyTask[], dateKey: string) {
  return tasks
    .filter((task) => task.date === dateKey)
    .sort((left, right) => {
      if (left.completed !== right.completed) {
        return Number(left.completed) - Number(right.completed);
      }

      const priorityRank = { high: 0, medium: 1, low: 2 };
      return priorityRank[left.priority] - priorityRank[right.priority];
    });
}

export function getOverdueTasks(tasks: DailyTask[], dateKey: string) {
  return tasks.filter((task) => !task.completed && task.date < dateKey);
}

export function getTopTasks(tasks: DailyTask[], limit = 3) {
  const priorityRank = { high: 0, medium: 1, low: 2 };

  return [...tasks]
    .filter((task) => !task.completed)
    .sort((left, right) => {
      return priorityRank[left.priority] - priorityRank[right.priority];
    })
    .slice(0, limit);
}

export function getDailyProgress(tasks: DailyTask[]) {
  if (tasks.length === 0) {
    return 0;
  }

  return Math.round(
    (tasks.filter((task) => task.completed).length / tasks.length) * 100,
  );
}

export function getTasksForWeeklyGoal(tasks: DailyTask[], weeklyGoalId: string) {
  return tasks.filter((task) => task.weeklyGoalId === weeklyGoalId);
}

export function getWeeklyGoalsForMonth(
  weeklyGoals: WeeklyGoal[],
  monthlyGoalId: string,
) {
  return weeklyGoals.filter((goal) => goal.monthlyGoalId === monthlyGoalId);
}

export function getWeeklyGoalsForDate(weeklyGoals: WeeklyGoal[], dateKey: string) {
  return weeklyGoals.filter(
    (goal) => goal.startDate <= dateKey && goal.endDate >= dateKey,
  );
}

export function getWeeklyGoalsInRange(
  weeklyGoals: WeeklyGoal[],
  start: string,
  end: string,
) {
  return weeklyGoals.filter((goal) => goal.startDate <= end && goal.endDate >= start);
}

export function getMonthlyGoalsForDate(monthlyGoals: MonthlyGoal[], dateKey: string) {
  const currentDate = parseISO(dateKey);
  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  return monthlyGoals.filter((goal) => goal.month === month && goal.year === year);
}

export function buildLifeAreaDistribution(
  state: AppState,
  start?: string,
  end?: string,
) {
  const distribution = state.lifeAreas.reduce<Record<string, number>>(
    (result, lifeArea) => {
      result[lifeArea] = 0;
      return result;
    },
    {},
  );

  state.dailyTasks.forEach((task) => {
    if (start && end && (task.date < start || task.date > end)) {
      return;
    }

    distribution[task.lifeArea] = (distribution[task.lifeArea] ?? 0) + 1;
  });

  state.monthlyGoals.forEach((goal) => {
    if (start && end) {
      const goalDate = toDateKey(new Date(goal.year, goal.month - 1, 1));
      if (goalDate < start || goalDate > end) {
        return;
      }
    }

    distribution[goal.lifeArea] = (distribution[goal.lifeArea] ?? 0) + 1;
  });

  return distribution;
}

export function getTodaySnapshot(state: AppState, dateKey: string) {
  const todayTasks = getTasksForDate(state.dailyTasks, dateKey);
  const overdueTasks = getOverdueTasks(state.dailyTasks, dateKey);
  const week = getWeekRange(dateKey);
  const weeklyGoals = getWeeklyGoalsInRange(
    state.weeklyGoals,
    week.startKey,
    week.endKey,
  );
  const monthlyGoals = getMonthlyGoalsForDate(state.monthlyGoals, dateKey);

  return {
    todayTasks,
    overdueTasks,
    weeklyGoals,
    monthlyGoals,
    todayProgress: getDailyProgress(todayTasks),
  };
}

export function getJournalEntryForDate(state: AppState, dateKey: string) {
  return state.journalEntries.find((entry) => entry.date === dateKey);
}

export function getCarryOverUrgency(task: DailyTask, dateKey: string) {
  const age = differenceInCalendarDays(parseISO(dateKey), parseISO(task.date));
  return task.carryOverCount + Math.max(age, 0);
}
