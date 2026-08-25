import React from "react"

interface timerState{
    time: String;
}

const tempo = { minutos: 0, segundos: 0 };

export default class Timer extends React.Component<any, timerState>{
    constructor(props: any){
        super(props)
        this.state = {
            time: ''
        }
        this.formatTime = this.formatTime.bind(this)
        this.updateTimer = this.updateTimer.bind(this)
        this.startCount = this.startCount.bind(this)
    }

    formatTime = (time: any) => (time < 10 ? `0${time}` : time);

    updateTimer( minutos: any, segundos: any ) {
        tempo.minutos = minutos;
        tempo.segundos = segundos;
        if (segundos >= 59) {
          tempo.minutos = minutos + 1;
          tempo.segundos = segundos - 60;
        }
        minutos = this.formatTime(minutos);
        segundos = this.formatTime(segundos);
        this.setState({time: minutos + ":" + segundos})
      }

      startCount(){
        tempo.segundos = tempo.segundos + 1;
        this.updateTimer(tempo.minutos, tempo.segundos)
        }

        componentDidMount(){
            setInterval(this.startCount, 1000)
        }

    render(){
        return(
            <div>
                {this.state.time}
            </div>
        )
    }
}