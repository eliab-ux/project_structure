import React from 'react';

export default class Lixeira extends React.Component{
    render(){
        return(
            <div className="pl-2 mx-3 md:mr-40">
                <button>
                    <svg width="26" height="24" viewBox="0 0 30 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1.66669 7.66667H28.3334M26.6667 7.66667L25.2217 27.9033C25.1618 28.7443 24.7855 29.5314 24.1685 30.106C23.5516 30.6806 22.7398 31 21.8967 31H8.10335C7.26025 31 6.44846 30.6806 5.8315 30.106C5.21453 29.5314 4.83821 28.7443 4.77835 27.9033L3.33335 7.66667H26.6667ZM11.6667 14.3333V24.3333V14.3333ZM18.3334 14.3333V24.3333V14.3333ZM20 7.66667V2.66667C20 2.22464 19.8244 1.80072 19.5119 1.48816C19.1993 1.17559 18.7754 1 18.3334 1H11.6667C11.2247 1 10.8007 1.17559 10.4882 1.48816C10.1756 1.80072 10 2.22464 10 2.66667V7.66667H20Z" stroke="#FF0000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </button>
            </div>
        )
    }
}