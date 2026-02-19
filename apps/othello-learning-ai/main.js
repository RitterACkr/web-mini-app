// タブの切り替え
document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        // activeクラスをボタンから外す
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        // sectionの切り替え
        document.querySelectorAll(".tab-content").forEach(sec => {
            sec.style.display = "none";
        });
        const target = document.getElementById("tab-" + btn.dataset.tab);
        if (target) target.style.display = "block";
    })
})