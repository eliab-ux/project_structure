import axios from "axios";
import { daily_config } from "../config/daily.config";
import * as dotenv from "dotenv";
dotenv.config();

export default class ApiService {
  private dailyURL: string;
  private dailyApiKey: string;
  constructor() {
    this.dailyApiKey = process.env.DAILYCOAPIKEY;
    this.dailyURL = daily_config.daily_api_host;
  }

  public RequestData(
    HTTPMethod: any,
    endpoint: string,
    payload: any = "",
    data: any = {},
    queryParams: string = ""
  ) {
    let url = `${this.dailyURL}${endpoint}`;
    if (payload !== "") url = `${url}/${payload}`;
    if (queryParams !== "") url = `${url}?${queryParams}`;
    return new Promise((resolve, reject) => {
      axios({
        method: HTTPMethod,
        headers: {
          authorization: `Bearer ${this.dailyApiKey}`,
        },
        url: url,
        data: data,
      })
        .then((response) => resolve(response.data))
        .catch((err: any) => reject(err.response.data));
    });
  }
}
