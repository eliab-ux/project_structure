import DailyIframe, { DailyParticipantsObject } from "@daily-co/daily-js";
import "../../styles/prejoin.css"
import axios from "axios";
import React from "react";

interface iStates {
  meeting_code: string;
}

export default class Prejoin extends React.Component<any, iStates> {
  private callObject;
  local_ref: any;
  remote_ref: any;
  constructor(props: any) {
    super(props);
    this.state = {
      meeting_code: window.location.href.split("/").reverse()[0]
    };
    console.log("Prejoin constructor", this.state, window.location.href)
    this.callObject = DailyIframe.createCallObject();
    this.handleChange = this.handleChange.bind(this);
  }
  handleChange = (event: any) =>
    this.setState({ [event.target.name]: event.target.value } as any);
  componentDidMount() {
    console.log("Prejoin componentDidMount")
    navigator.mediaDevices
      .getUserMedia({
        video: true,
        audio: false,
      })
      .then((stream: any) => {
        let video: any = document.querySelector("video");
        video.srcObject = stream;
      });
  }
  render() {
    return (
      <React.Fragment>
        <video className="prejoin-camera" autoPlay={true}></video>
        <button className="px-5 py-3 m-5 text-sm font-semibold text-white bg-gray-900 border border-gray-300 rounded hover:shadow-lg hover:bg-gray-800 hover:text-gray-100" >Entrar</button>
        <p className="text-white">https://twitter.com/Rukaszu/status/1468348807322681345</p>
        <div id="users-container"></div>
      </React.Fragment>
    );
  }
}
