import "./polyfill";
import createWindow from "./app/main";
import { app } from "electron";

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  createWindow();
}
