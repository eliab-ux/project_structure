import React from "react";

interface IModalProps {
    openModalComponent: any
    /* exitButton: any */
    content?: any
}


interface IModalState {
    trigger: boolean
}

export default class Modal extends React.Component<IModalProps, IModalState>{
    constructor(props: IModalProps) {
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
                <button onClick={this.changeTrigger}>
                    <this.props.openModalComponent />
                </button>
                {this.state.trigger === true ?
                    <section>
                        <div className="fixed inset-0 z-50 flex justify-center overflow-x-hidden outline-none overscroll-contain focus:outline-none">
                            <div className="relative w-full mx-auto my-6">
                                <div className="relative flex flex-col w-full border-0 rounded-lg outline-none focus:outline-none">

                                    <article className="relative flex-auto w-full mx-auto bg-gray-100 rounded md:w-1/2">
                                        {this.props.content ?
                                            <this.props.content closeModal={this.changeTrigger} />
                                            : this.props.children
                                        }
                                    </article>

                                        <div className="flex justify-center mx-auto mt-4 rounded-b md:w-1/2">
                                            <button
                                                onClick={this.changeTrigger}
                                                className="z-40 flex items-center justify-center w-12 h-12 text-white transition transform rotate-45 bg-red-500 border border-red-500 rounded hover:border-white hover:-rotate-45 hover:bg-white hover:text-red-500"
                                            > + </button>
                                        </div> 

                                </div>
                            </div>
                        </div>


                        <div role="button" onClick={this.changeTrigger} className="fixed inset-0 z-40 bg-black bg-opacity-70"></div>


                    </section>
                    : null}

            </div>

        );
    }
}