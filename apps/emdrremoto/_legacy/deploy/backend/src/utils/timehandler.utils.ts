export default class TimeHandler {
  dateToTimestamp(plusHour: number = 0): number {
    const date: Date = new Date();

    const d: number = Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours() + plusHour,
      date.getMinutes(),
      date.getSeconds()
    );
    return d;
  }
}
