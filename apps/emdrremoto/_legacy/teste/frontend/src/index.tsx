import React from "react";
import ReactDOM from "react-dom";
import "./styles/index.css";
import { Notifications } from 'react-push-notification';
import App from "./App";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

ReactDOM.render(
  <React.StrictMode>
    <App />
    <Notifications position="top-right"/>
    <ToastContainer />
    {/* <Chat></Chat> */}
  </React.StrictMode>,
  document.getElementById("root")
);
