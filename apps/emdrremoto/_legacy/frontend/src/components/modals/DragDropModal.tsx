import React from "react";
import './dragdropModal.css'
import './drag'

interface IModalProps {
    openModalComponent: any
    content?: any
    socket?: any
}

interface IModalState {
    trigger: boolean
    draggableDiv: any
    newMessage:boolean
    newMessageClass:any
}

export default class DragDropModal extends React.Component<IModalProps, IModalState>{
    constructor(props: IModalProps) {
        super(props)
        this.state = {
            trigger: false,
            draggableDiv: React.createRef(),
            newMessage:false,
            newMessageClass:{
                new:'z-30 p-5 mx-1 border rounded lg:p-3 text-white lg:text-white hover:bg-white bg-green-600 hover:text-black text-xs font-semibold',
                notNew:'z-30 p-5 mx-1 border rounded lg:p-3 text-black lg:text-white hover:bg-white hover:text-black text-xs font-semibold',
            },
        }
        this.changeTrigger = this.changeTrigger.bind(this)
        this.dragElement = this.dragElement.bind(this)
        this.changeColor = this.changeColor.bind(this)
    }

    changeTrigger = () => this.setState({ trigger: !this.state.trigger })

    componentDidUpdate(){
        this.dragElement(this.state.draggableDiv.current)
        
    }
    componentDidMount(){
        this.props.socket.on("new-message", ({ message }: any) => {
            this.setState({newMessage:true})
          });
    }

changeColor(){
    this.setState({newMessage:false})
}

dragElement(elmnt: any) {
    // console.log('entrou na função dragElement')
    // console.log(elmnt)
  var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  if(elmnt){

    if (document.getElementById(elmnt.id + "header")) {
      /* if present, the header is where you move the DIV from:*/
      document.getElementById(elmnt.id + "header")!.onmousedown = dragMouseDown;
    } else {
      /* otherwise, move the DIV from anywhere inside the DIV:*/
      elmnt.onmousedown = dragMouseDown;
    }
  }

  function dragMouseDown(e: any) {
    e = e || window.event;
    e.preventDefault();
    // get the mouse cursor position at startup:
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    // call a function whenever the cursor moves:
    document.onmousemove = elementDrag;
  }

  function elementDrag(e: any) {
    e = e || window.event;
    e.preventDefault();
    // calculate the new cursor position:
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    // set the element's new position:
    elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
    elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
  }

  function closeDragElement() {
    /* stop moving when mouse button is released:*/
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

    render() {

        return (
            <div>
                <button onClick={this.changeTrigger}>
                    <this.props.openModalComponent newMessageClass={this.state.newMessage ? this.state.newMessageClass.new : this.state.newMessageClass.notNew} changeColor={this.changeColor}/>
                </button>
                
                    <section className={this.state.trigger? 'block' : 'hidden'}>
                        <div id="mydiv" className="fixed top-0 left-0" ref={this.state.draggableDiv} >
                            <div className="relative w-full mx-auto my-6">
                                <div className="relative flex flex-col w-full border-0 rounded-lg outline-none focus:outline-none">
                                    <article className="relative w-full mx-auto overflow-auto bg-gray-100 rounded">
                                    <div className="" id="mydivheader">Clique aqui para mover o chat</div>
                                        {this.props.content ?
                                            <this.props.content closeModal={this.changeTrigger} socket={this.props.socket} trigger={this.changeTrigger}/>
                                            : this.props.children
                                        }
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