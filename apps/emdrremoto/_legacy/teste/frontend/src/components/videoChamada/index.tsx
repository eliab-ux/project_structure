import React from "react";


export default class Modal extends React.Component<any, any>{
    constructor(props: any) {
        super(props)
        this.state = {
            trigger: false,
        }
        this.changeTrigger = this.changeTrigger.bind(this)
    }

    changeTrigger = () => this.setState({ trigger: !this.state.trigger })

    render() {

        return (
            <div>
                Ai chavi
            </div>

        );
    }
}