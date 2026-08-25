import React from "react";
import { sendIcon } from "../home/mocks/icons";

export default class InviteButton extends React.Component{
    render(){
        return(
            <button className="z-30 p-5 mx-1 h-12 w-12 rounded lg:p-3 bg-gray-800 lg:text-white hover:bg-white hover:text-black text-xs font-semibold" >
                {sendIcon}
                </button>
        )
    }
}