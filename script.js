let chart = null;

let selectedChartType = "pie";


const dataRows =
    document.getElementById("dataRows");

const addRowBtn =
    document.getElementById("addRowBtn");

const generateBtn =
    document.getElementById("generateBtn");

const clearBtn =
    document.getElementById("clearBtn");

const downloadBtn =
    document.getElementById("downloadBtn");

const shareBtn =
    document.getElementById("shareBtn");

const chartTitle =
    document.getElementById("chartTitle");

const unit =
    document.getElementById("unit");

const displayTitle =
    document.getElementById("displayTitle");

const totalText =
    document.getElementById("totalText");



// ADD DATA ROW

function addRow(category = "", value = "") {

    const row =
        document.createElement("div");

    row.className = "data-row";


    row.innerHTML = `

        <input
            type="text"
            class="category"
            placeholder="Category"
            value="${category}"
        >

        <input
            type="number"
            class="value"
            placeholder="Value"
            value="${value}"
            min="0"
        >

        <button class="remove-btn">
            ×
        </button>

    `;


    row.querySelector(".remove-btn")
        .addEventListener("click", function () {

            row.remove();

        });


    dataRows.appendChild(row);

}



// START WITH 3 ROWS

addRow();
addRow();
addRow();



// ADD ROW

addRowBtn.addEventListener(
    "click",
    function () {

        addRow();

    }
);



// CHOOSE CHART TYPE

document
    .querySelectorAll(".chart-type")
    .forEach(button => {

        button.addEventListener(
            "click",
            function () {

                document
                    .querySelectorAll(".chart-type")
                    .forEach(btn => {

                        btn.classList.remove("active");

                    });


                this.classList.add("active");


                selectedChartType =
                    this.dataset.type;

            }
        );

    });



// GENERATE CHART

generateBtn.addEventListener(
    "click",
    function () {

        const categories = [];
        const values = [];


        const rows =
            document.querySelectorAll(".data-row");


        rows.forEach(row => {

            const category =
                row.querySelector(".category")
                    .value
                    .trim();


            const value =
                Number(
                    row.querySelector(".value").value
                );


            if (
                category !== "" &&
                !isNaN(value)
            ) {

                categories.push(category);

                values.push(value);

            }

        });


        if (categories.length < 2) {

            alert(
                "Please enter at least two pieces of data."
            );

            return;

        }


        createChart(
            categories,
            values
        );

    }
);



// CREATE CHART

function createChart(
    categories,
    values
) {

    const canvas =
        document.getElementById("myChart");


    if (chart !== null) {

        chart.destroy();

    }


    const selectedUnit =
        unit.value;


    const title =
        chartTitle.value.trim()
        || "Your Data";


    displayTitle.textContent =
        title;


    const total =
        values.reduce(
            (sum, value) =>
                sum + value,
            0
        );


    totalText.textContent =
        `Total: ${selectedUnit} ${total}`;


    chart =
        new Chart(
            canvas,
            {

                type:
                    selectedChartType,

                data:
                    {

                        labels:
                            categories,

                        datasets:
                            [

                                {

                                    label:
                                        title,

                                    data:
                                        values,

                                    borderWidth:
                                        2,

                                    backgroundColor:
                                        [

                                            "#6366f1",

                                            "#ec4899",

                                            "#14b8a6",

                                            "#f59e0b",

                                            "#ef4444",

                                            "#8b5cf6",

                                            "#06b6d4",

                                            "#84cc16"

                                        ],

                                    borderColor:
                                        "#ffffff"

                                }

                            ]

                    },


                options:
                    {

                        responsive:
                            true,

                        plugins:
                            {

                                legend:
                                    {

                                        position:
                                            "bottom"

                                    },

                                tooltip:
                                    {

                                    callbacks:
                                        {

                                        label:
                                            function(context) {

                                                return `${context.label}: ${selectedUnit} ${context.raw}`;

                                            }

                                        }

                                    }

                            }

                    }

            }
        );

}



// DOWNLOAD

downloadBtn.addEventListener(
    "click",
    function () {

        if (chart === null) {

            alert(
                "Generate a chart first."
            );

            return;

        }


        const link =
            document.createElement("a");


        link.download =
            "dataviz-chart.png";


        link.href =
            document
                .getElementById("myChart")
                .toDataURL("image/png");


        link.click();

    }
);



// SHARE

shareBtn.addEventListener(
    "click",
    async function () {

        if (!chart) {

            alert(
                "Generate a chart first."
            );

            return;

        }


        try {

            const canvas =
                document.getElementById(
                    "myChart"
                );


            const blob =
                await new Promise(
                    resolve =>
                        canvas.toBlob(resolve)
                );


            const file =
                new File(
                    [blob],
                    "dataviz-chart.png",
                    {
                        type:
                            "image/png"
                    }
                );


            if (
                navigator.share &&
                navigator.canShare &&
                navigator.canShare({
                    files: [file]
                })
            ) {

                await navigator.share({

                    title:
                        "My DataViz Chart",

                    text:
                        "Created with DataViz",

                    files:
                        [file]

                });

            } else {

                alert(
                    "Sharing isn't supported here. Use Download instead."
                );

            }

        }

        catch (error) {

            console.log(error);

        }

    }
);



// CLEAR

clearBtn.addEventListener(
    "click",
    function () {

        dataRows.innerHTML = "";

        addRow();
        addRow();
        addRow();


        chartTitle.value = "";

        unit.value = "";


        displayTitle.textContent =
            "Your Chart";


        totalText.textContent = "";


        if (chart !== null) {

            chart.destroy();

            chart = null;

        }

    }
);