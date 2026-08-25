import React from "react";
import { cameraIcon } from "../../icons/icons";
import './dragCamera.css'

interface IModalProps {
    openModalComponent?: any
    content?: any
    socket?: any
}

interface IModalState {
    trigger: boolean
    draggableDiv: any
}

export default class DragCamera extends React.Component<IModalProps, IModalState>{
    constructor(props: IModalProps) {
        super(props)
        this.state = {
            trigger: false,
            draggableDiv: React.createRef()
        }
        this.changeTrigger = this.changeTrigger.bind(this)
        this.dragElement = this.dragElement.bind(this)
    }

    changeTrigger = () => this.setState({ trigger: !this.state.trigger })

    componentDidUpdate(){
        this.dragElement(this.state.draggableDiv.current)
    }


dragElement(elmnt: any) {
  var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  if(elmnt){

    if (document.getElementById(elmnt.id + "header")) {
      document.getElementById(elmnt.id + "header")!.onmousedown = dragMouseDown;
    } else {
      elmnt.onmousedown = dragMouseDown;
    }
  }

  function dragMouseDown(e: any) {
    e = e || window.event;
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e: any) {
    e = e || window.event;
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
    elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

    render() {

        return (
            <div>
                <button className={`absolute z-50 px-3 hover:bg-white py-1 mx-auto text-white bg-gray-900 rounded top-0 right-0 ${this.state.trigger? 'text-red-500' : 'text-green-500' }`} onClick={this.changeTrigger}>
                    {cameraIcon }
                </button>
                    <section className={this.state.trigger? 'block' : 'hidden'}>
                        <div id="cameraDiv" className="fixed m-auto" ref={this.state.draggableDiv} >
                            <div className="relative lg:w-80 md:w-60 w-40 mx-auto my-6">
                                <div className="relative flex flex-col w-full border-0 rounded-lg outline-none focus:outline-none">
                                    <article className="relative w-full mx-auto overflow-auto bg-gray-100 rounded">
                                    <div className="text-black" id="cameraDivheader">Clique aqui para mover A câmera</div>
                                        {this.props.children}
                                    </article>

                                        <div className="flex justify-center mx-auto mt-5 mb-4 rounded-b lg:w-1/2">
                                            <button
                                                onClick={this.changeTrigger}
                                                className="z-40 flex items-center justify-center w-12 h-12 text-white transition transform rotate-45 bg-red-500 border border-red-500 rounded hover:border-white hover:-rotate-45 hover:bg-white hover:text-red-500"
                                            > + </button>
                                        </div> 

                                </div>
                            </div>
                        </div>
                    </section>

            </div>

        );

        

    }
}