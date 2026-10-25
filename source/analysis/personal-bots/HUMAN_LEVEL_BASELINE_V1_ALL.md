# Human-information real-board baseline

SUPERSEDED infrastructure control: production replay/timing are valid, but planner
index tie-breaking bypassed part of the public salt. Do not use this run as the
comparison baseline. The corrected full baseline is v2; original rows stay preserved.

Public rule: current free-tile takeability and drawn back overlays; hidden pictures remain gated.
Salts:1,2,3; max12 real tries per salt; no re-deals.

| Level | Group | Dennis | Bot salts1/2/3 | Mean | Dennis+1 | Minutes/board |
|---:|---|---:|---|---:|---|---:|
|17†|natural|1|1/1/1|1.00|true|1.57|
|18†|natural|1|1/1/1|1.00|true|0.92|
|19†|natural|1|1/1/1|1.00|true|1.56|
|20†|natural|1|1/1/1|1.00|true|1.67|
|21†|natural|1|1/1/1|1.00|true|1.30|
|22†|natural|1|1/1/1|1.00|true|0.64|
|23†|natural|1|1/1/1|1.00|true|0.68|
|24†|natural|1|1/1/1|1.00|true|1.07|
|25†|natural|1|1/1/1|1.00|true|1.77|
|26†|natural|2|1/1/1|1.00|true|0.48|
|27†|natural|1|1/1/1|1.00|true|0.62|
|28†|natural|1|1/1/1|1.00|true|0.73|
|29†|natural|2|1/1/1|1.00|true|0.60|
|30†|natural|1|1/1/1|1.00|true|0.49|
|31†|natural|1|1/1/1|1.00|true|1.47|
|32†|natural|2|1/1/1|1.00|true|0.90|
|33†|natural|2|1/1/1|1.00|true|0.68|
|34†|natural|1|1/1/1|1.00|true|1.20|
|35†|natural|1|1/1/1|1.00|true|1.02|
|36†|natural|2|1/1/1|1.00|true|0.68|
|37†|natural|1|1/1/1|1.00|true|0.90|
|38†|natural|6|1/1/1|1.00|true|0.77|
|39†|natural|1|1/1/1|1.00|true|1.01|
|40†|natural|1|1/1/1|1.00|true|1.71|
|41†|natural|1|1/1/1|1.00|true|0.59|
|42†|natural|1|1/1/1|1.00|true|0.93|
|43†|natural|1|1/1/1|1.00|true|2.31|
|44†|natural|1|1/1/1|1.00|true|1.06|
|45†|natural|1|1/1/1|1.00|true|1.45|
|46†|natural|1|1/1/1|1.00|true|1.01|
|47†|natural|1|1/1/1|1.00|true|1.02|
|48†|natural|1|1/1/1|1.00|true|0.82|
|49†|natural|1|1/1/1|1.00|true|0.70|
|50†|natural|1|1/1/1|1.00|true|1.10|
|51†|natural|1|1/1/1|1.00|true|0.67|
|52†|natural|2|1/1/1|1.00|true|0.51|
|53†|natural|1|1/1/1|1.00|true|0.34|
|54†|natural|2|1/1/1|1.00|true|0.70|
|55†|natural|1|1/1/1|1.00|true|0.46|
|56†|natural|1|1/1/1|1.00|true|2.81|
|57†|natural|1|1/1/1|1.00|true|0.47|
|58†|natural|4|1/1/1|1.00|true|0.52|
|59†|natural|1|1/1/1|1.00|true|0.45|
|60†|natural|1|1/1/1|1.00|true|0.94|
|61†|natural|1|1/1/1|1.00|true|0.75|
|62†|natural|1|1/1/1|1.00|true|0.88|
|63†|natural|1|1/1/1|1.00|true|0.49|
|64†|natural|1|1/1/1|1.00|true|0.52|
|65†|natural|1|1/1/1|1.00|true|0.28|
|66†|natural|1|1/1/1|1.00|true|0.33|
|67†|natural|1|1/1/1|1.00|true|0.51|
|68†|natural|1|1/1/1|1.00|true|0.23|
|69†|natural|2|1/1/1|1.00|true|0.81|
|70†|natural|1|1/1/1|1.00|true|1.29|
|71†|natural|1|1/1/1|1.00|true|0.32|
|72†|natural|3|1/1/1|1.00|true|1.08|
|73†|natural|2|1/1/1|1.00|true|0.38|
|74†|natural|2|1/1/1|1.00|true|0.84|
|75†|natural|11|1/1/1|1.00|true|0.73|
|76|natural|2|1/1/1|1.00|true|0.31|
|77|natural|1|1/1/1|1.00|true|0.40|
|78|natural|1|1/1/1|1.00|true|0.43|
|79|natural|1|1/1/1|1.00|true|0.33|
|80|natural|1|1/1/1|1.00|true|0.82|
|81|natural|1|2/2/2|2.00|true|0.34|
|82|natural|1|1/1/1|1.00|true|0.50|
|83|natural|1|1/1/1|1.00|true|0.33|
|84|natural|1|1/1/1|1.00|true|0.35|
|85|natural|1|1/1/1|1.00|true|0.53|
|86|natural|1|1/1/3|1.67|false|1.43|
|87|natural|2|1/1/1|1.00|true|0.63|
|88|natural|3|1/1/1|1.00|true|0.24|
|89|natural|2|1/1/1|1.00|true|0.34|
|90|natural|1|1/1/1|1.00|true|0.46|
|91|natural|1|1/1/1|1.00|true|0.15|
|92|natural|5|3/3/3|3.00|true|1.50|
|93|natural|1|2/2/2|2.00|true|0.48|
|94|natural|1|1/1/1|1.00|true|0.41|
|95|natural|2|1/1/1|1.00|true|0.13|
|96|natural|1|1/1/1|1.00|true|0.19|
|97|natural|3|1/1/1|1.00|true|0.68|
|98|natural|1|1/1/1|1.00|true|0.45|
|99|natural|2|2/2/2|2.00|true|0.49|
|100|natural|3|1/1/1|1.00|true|0.33|
|101|natural|1|1/1/1|1.00|true|0.16|
|102|natural|2|3/3/3|3.00|true|1.11|
|103|natural|1|1/1/1|1.00|true|0.38|
|104|natural|4|1/1/1|1.00|true|0.14|
|105|natural|1|1/1/1|1.00|true|0.29|
|106|natural|3|1/1/1|1.00|true|0.12|
|107|natural|1|2/2/2|2.00|true|0.47|
|108|natural|2|1/1/1|1.00|true|0.77|
|109|natural|4|1/1/1|1.00|true|0.14|
|110|natural|1|1/1/1|1.00|true|0.61|
|111|natural|3|2/2/2|2.00|true|0.86|
|112|natural|1|2/2/2|2.00|true|0.43|
|113|natural|1|1/1/1|1.00|true|0.30|
|114|natural|1|1/1/1|1.00|true|0.26|
|115|natural|4|1/1/1|1.00|true|0.23|
|116|natural|2|1/1/1|1.00|true|0.22|
|117|natural|1|1/1/1|1.00|true|0.15|
|118|natural|3|1/1/1|1.00|true|0.34|
|119|natural|2|1/1/1|1.00|true|0.45|
|120|natural|3|1/1/1|1.00|true|0.89|
|121|natural|4|2/2/2|2.00|true|0.52|
|122|natural|4|1/1/1|1.00|true|0.12|
|123|natural|1|1/1/1|1.00|true|0.61|
|124|natural|3|4/4/4|4.00|true|2.48|
|125|natural|1|2/2/2|2.00|true|0.51|
|126|natural|1|1/1/1|1.00|true|0.29|
|127|natural|1|1/1/1|1.00|true|0.11|
|128|natural|1|1/1/1|1.00|true|0.14|
|129|natural|1|1/1/1|1.00|true|0.40|
|130|natural|2|1/1/1|1.00|true|0.52|
|131|natural|3|1/1/1|1.00|true|0.23|
|132|natural|4|1/1/1|1.00|true|0.22|
|133|natural|1|1/1/1|1.00|true|0.52|
|134|natural|1|1/1/1|1.00|true|0.14|
|135|natural|1|1/1/1|1.00|true|0.29|
|136|natural|1|1/1/1|1.00|true|0.37|
|137|natural|2|2/2/2|2.00|true|0.39|
|138|natural|1|1/1/1|1.00|true|0.26|
|139|natural|3|1/1/1|1.00|true|0.39|
|140|natural|1|1/1/1|1.00|true|0.51|
|141|natural|1|2/2/2|2.00|true|0.26|
|142|natural|1|1/1/1|1.00|true|0.10|
|143|natural|1|1/1/1|1.00|true|0.22|
|144|natural|1|5/5/5|5.00|false|0.59|
|145|natural|1|1/1/1|1.00|true|0.36|
|146|natural|1|1/1/1|1.00|true|0.45|
|147|natural|1|1/1/1|1.00|true|0.29|
|148|natural|1|1/1/1|1.00|true|0.20|
|149|natural|2|1/1/1|1.00|true|0.35|
|150|natural|3|>12/unresolved/>12/unresolved/>12/unresolved|unresolved|false|7.15|
|151|natural|2|1/1/1|1.00|true|0.18|
|152|natural|2|1/1/1|1.00|true|0.61|
|153|natural|1|1/1/1|1.00|true|0.22|
|154|natural|3|1/1/1|1.00|true|0.15|
|155|natural|1|1/1/1|1.00|true|0.19|
|156|natural|3|1/1/1|1.00|true|0.14|
|10011|lab|2|8/8/8|8.00|false|5.68|
|10012|lab|6|4/4/4|4.00|true|0.58|
|10015|lab|11|1/1/1|1.00|true|0.41|
|10032|lab|5|>12/unresolved/>12/unresolved/>12/unresolved|unresolved|false|5.91|
|10033|lab|5|>12/unresolved/>12/unresolved/>12/unresolved|unresolved|false|8.16|
|10041|lab|7|>12/unresolved/>12/unresolved/>12/unresolved|unresolved|false|5.78|
|10042|lab|4|2/2/2|2.00|true|0.85|
|10044|lab|1|1/1/1|1.00|true|0.49|
|10045|lab|6|3/3/3|3.00|true|0.83|
|10046|lab|1|1/1/1|1.00|true|0.51|
|10047|lab|1|1/1/1|1.00|true|0.34|
|10048|lab|2|1/1/1|1.00|true|0.44|
|10049|lab|2|>12/unresolved/>12/unresolved/>12/unresolved|unresolved|false|1.45|
|10052|lab|3|>12/unresolved/>12/unresolved/>12/unresolved|unresolved|false|3.19|
|10053|lab|2|1/1/1|1.00|true|0.22|

Gates:{"clearance":false,"dennisPlusOne":false,"totalTries":false,"difficulty":false}; valid:true.
Dennis total:290; bot totals per salt:unresolved/unresolved/unresolved; mean bot total:unresolved.
Spearman:unresolved; cleared-only diagnostic:-0.1744720576468123; eligible cleared pairs:62.
Slowest move:1512.4ms; mean minutes/board for3 salts:0.83.
Largest mismatches(double underestimates):150:uncleared,10032:uncleared,10033:uncleared,10041:uncleared,10049:uncleared,10052:uncleared,75:20,10015:20,38:10,58:6.
† No exact historical opening recording; uses the explicitly authorized board definition.
Catalog:4ee62f8f40723e7f7de9f80a07b32db6e446648c46cb5cdc31891733825a34cf; source:8471bd97b1854d208508db8c7a35ceddbec88099c901dea53e23cea964abb018; profile:dc0d1ecd18b9fcc9c860187df2a9ae3bf7abcc56361e201aa2f94d0eb87a78f2.
