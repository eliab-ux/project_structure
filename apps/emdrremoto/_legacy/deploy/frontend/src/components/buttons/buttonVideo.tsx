import React from "react";
import {hide} from "../../pages/emdr/icons";

interface IButtonVideoProps {
    closeModal: () => void;
}

export default class ButtonVideo extends React.Component<IButtonVideoProps> {
    render() {
        return(
            <div>
                <button onClick={this.props.closeModal} className="p-3 text-white border rounded">{hide}</button>
            </div>

        )
    }
}
